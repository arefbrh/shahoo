import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ObjectStorage {
  put(name: string, bytes: Uint8Array): Promise<void>;
  read(name: string): Promise<Uint8Array | null>;
  remove(name: string): Promise<void>;
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

/**
 * Local disk is the development default. Production must opt in with
 * ALLOW_LOCAL_STORAGE=true because a serverless disk is not durable.
 * Any other STORAGE_PROVIDER stays disconnected until a real adapter exists.
 */
export function localStorageAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const provider = (env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  if (provider && provider !== "local") return false;
  if (env.NODE_ENV === "production") {
    const flag = (env.ALLOW_LOCAL_STORAGE ?? "").trim().toLowerCase();
    return flag === "1" || flag === "true";
  }
  return true;
}

export function openStorage(env: NodeJS.ProcessEnv = process.env): ObjectStorage | null {
  if (!localStorageAllowed(env)) return null;
  return new LocalDiskStorage(env.STORAGE_LOCAL_DIR?.trim() || undefined);
}

export function localObjectName(storageKey: string): string | null {
  if (!storageKey.startsWith("local:")) return null;
  const name = storageKey.slice("local:".length);
  return SAFE_NAME.test(name) ? name : null;
}
