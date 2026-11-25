import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ObjectStorage {
  put(name: string, bytes: Uint8Array): Promise<void>;
  read(name: string): Promise<Uint8Array | null>;
  remove(name: string): Promise<void>;
  storageKey(name: string): string;
}

const SAFE_NAME = /^[A-Za-z0-9_-]{8,80}\.(jpg|png|gif|webp)$/;

export function localMediaDir(): string {
  return process.env.STORAGE_LOCAL_DIR?.trim() || join(process.cwd(), "data", "media");
}

export class LocalDiskStorage implements ObjectStorage {
  private readonly root: string;

  constructor(root?: string) {
    this.root = root ?? localMediaDir();
  }

  storageKey(name: string) {
    return `local:${name}`;
  }

  async put(name: string, bytes: Uint8Array) {
    if (!SAFE_NAME.test(name)) throw new Error("unsafe_name");
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, name), bytes);
  }

  async read(name: string) {
    if (!SAFE_NAME.test(name)) return null;
    try {
      return await readFile(join(this.root, name));
    } catch {
      return null;
    }
  }

  async remove(name: string) {
    if (!SAFE_NAME.test(name)) return;
    await rm(join(this.root, name), { force: true });
  }
}

type S3Config = {
  endpoint: URL;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
};

function s3Config(env: NodeJS.ProcessEnv): S3Config | null {
  const endpointValue = (env.STORAGE_S3_ENDPOINT ?? env.S3_ENDPOINT ?? env.AWS_ENDPOINT_URL_S3)?.trim();
  const bucket = (env.STORAGE_S3_BUCKET ?? env.S3_BUCKET)?.trim();
  const region = (env.STORAGE_S3_REGION ?? env.S3_REGION ?? env.AWS_REGION)?.trim();
  const accessKeyId = (env.STORAGE_S3_ACCESS_KEY_ID ?? env.S3_ACCESS_KEY ?? env.AWS_ACCESS_KEY_ID)?.trim();
  const secretAccessKey = env.STORAGE_S3_SECRET_ACCESS_KEY ?? env.S3_SECRET_KEY ?? env.AWS_SECRET_ACCESS_KEY;
  if (!endpointValue || !bucket || !region || !accessKeyId || !secretAccessKey) return null;
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) return null;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(region)) return null;
  const prefix = (env.STORAGE_S3_PREFIX ?? env.S3_PREFIX ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (prefix && !/^[A-Za-z0-9/_-]{1,180}$/.test(prefix)) return null;
  try {
    const endpoint = new URL(endpointValue);
    if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(endpoint.hostname)) return null;
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
    return { endpoint, bucket, region, accessKeyId, secretAccessKey, prefix };
  } catch {
    return null;
  }
}

function hmac(key: Uint8Array | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** AWS Signature V4 adapter for S3-compatible object stores (including R2). */
export class S3ObjectStorage implements ObjectStorage {
  private readonly config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
  }

  storageKey(name: string) {
    return `s3:${name}`;
  }

  private signedRequest(method: "PUT" | "GET" | "DELETE", name: string, body?: Uint8Array) {
    if (!SAFE_NAME.test(name)) throw new Error("unsafe_name");
    const { endpoint, bucket, region, accessKeyId, secretAccessKey, prefix } = this.config;
    const key = [prefix, name].filter(Boolean).join("/");
    const encodePath = (part: string) => encodeURIComponent(part).replace(/[!'()*]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    const path = `/${[...endpoint.pathname.split("/").filter(Boolean), bucket, ...key.split("/")].map(encodePath).join("/")}`;
    const url = new URL(endpoint.origin);
    url.pathname = path;
    const payload = body ?? new Uint8Array();
    const payloadHash = sha256(payload);
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const contentType = method === "PUT" ? "application/octet-stream" : "";
    const canonicalHeaders =
      `host:${url.host}\n` +
      (contentType ? `content-type:${contentType}\n` : "") +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = contentType
      ? "host;content-type;x-amz-content-sha256;x-amz-date"
      : "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, "s3");
    const signingKey = hmac(serviceKey, "aws4_request");
    const signature = hmac(signingKey, stringToSign).toString("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const headers: Record<string, string> = {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization,
    };
    if (contentType) headers["content-type"] = contentType;
    return { url, headers, body: method === "PUT" ? Buffer.from(payload) : undefined };
  }

  async put(name: string, bytes: Uint8Array) {
    const request = this.signedRequest("PUT", name, bytes);
    const response = await fetch(request.url, { method: "PUT", headers: request.headers, body: request.body });
    if (!response.ok) throw new Error(`s3_put_failed_${response.status}`);
  }

  async read(name: string) {
    const request = this.signedRequest("GET", name);
    const response = await fetch(request.url, { method: "GET", headers: request.headers });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`s3_get_failed_${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async remove(name: string) {
    const request = this.signedRequest("DELETE", name);
    const response = await fetch(request.url, { method: "DELETE", headers: request.headers });
    if (!response.ok && response.status !== 404) throw new Error(`s3_delete_failed_${response.status}`);
  }
}

/**
 * Local disk is the development default. Production must opt in with
 * ALLOW_LOCAL_STORAGE=true because a serverless disk is not durable.
 */
export function localStorageAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  const provider = raw === "disk" ? "local" : raw;
  if (provider && provider !== "local") return false;
  if (env.NODE_ENV === "production") {
    const flag = (env.ALLOW_LOCAL_STORAGE ?? "").trim().toLowerCase();
    return flag === "1" || flag === "true";
  }
  return true;
}

export function openStorage(env: NodeJS.ProcessEnv = process.env): ObjectStorage | null {
  const raw = (env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  const provider = raw === "disk" ? "local" : raw;
  if (provider === "s3") {
    const config = s3Config(env);
    return config ? new S3ObjectStorage(config) : null;
  }
  if (!localStorageAllowed(env)) return null;
  return new LocalDiskStorage(env.STORAGE_LOCAL_DIR?.trim() || undefined);
}

export function objectNameForStorageKey(storageKey: string): string | null {
  const separator = storageKey.indexOf(":");
  if (separator < 0) return null;
  const provider = storageKey.slice(0, separator);
  const name = storageKey.slice(separator + 1);
  return (provider === "local" || provider === "s3") && SAFE_NAME.test(name) ? name : null;
}

export function localObjectName(storageKey: string): string | null {
  return storageKey.startsWith("local:") ? objectNameForStorageKey(storageKey) : null;
}
