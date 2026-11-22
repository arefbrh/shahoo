import assert from "node:assert/strict";
import test from "node:test";
import { LocalDiskStorage, S3ObjectStorage, objectNameForStorageKey, openStorage } from "./disk.ts";

const config = {
  endpoint: new URL("https://objects.example.test/storage"),
  bucket: "shahoo-media",
  region: "auto",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  prefix: "site/media",
};

test("S3 adapter signs PUT, GET and DELETE and preserves endpoint path prefix", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; init: RequestInit }> = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: new URL(String(input)), init });
    if (init.method === "GET") return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    return new Response(null, { status: 200 });
  };
  try {
    const storage = new S3ObjectStorage(config);
    const name = "med-12345678-abcd.jpg";
    await storage.put(name, new Uint8Array([7, 8, 9]));
    const read = await storage.read(name);
    await storage.remove(name);
    assert.deepEqual([...read ?? []], [1, 2, 3]);
    assert.equal(requests.length, 3);
    assert.deepEqual(requests.map((request) => request.init.method), ["PUT", "GET", "DELETE"]);
    for (const request of requests) {
      assert.equal(request.url.pathname, `/storage/shahoo-media/site/media/${name}`);
      const headers = new Headers(request.init.headers);
      assert.match(headers.get("authorization") ?? "", /^AWS4-HMAC-SHA256 Credential=test-access-key\//);
      assert.match(headers.get("x-amz-date") ?? "", /^\d{8}T\d{6}Z$/);
      assert.equal(headers.get("x-amz-content-sha256")?.length, 64);
    }
    assert.deepEqual([...new Uint8Array(requests[0].init.body as ArrayBuffer)], [7, 8, 9]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("S3 adapter rejects unsafe object names before network access", async () => {
  const storage = new S3ObjectStorage(config);
  await assert.rejects(() => storage.put("../escape.jpg", new Uint8Array([1])), /unsafe_name/);
  assert.equal(storage.storageKey("med-12345678-abcd.jpg"), "s3:med-12345678-abcd.jpg");
});

test("storage configuration fails closed and local disk is never a serverless production fallback", () => {
  assert.equal(openStorage({ NODE_ENV: "production", STORAGE_PROVIDER: "s3" } as NodeJS.ProcessEnv), null);
  assert.equal(openStorage({ NODE_ENV: "production", STORAGE_PROVIDER: "local" } as NodeJS.ProcessEnv), null);
  assert.equal(openStorage({
    NODE_ENV: "production", STORAGE_PROVIDER: "s3", STORAGE_S3_ENDPOINT: "https://objects.example.test",
    STORAGE_S3_BUCKET: "shahoo-media", STORAGE_S3_REGION: "auto",
    STORAGE_S3_ACCESS_KEY_ID: "key", STORAGE_S3_SECRET_ACCESS_KEY: "secret",
  } as NodeJS.ProcessEnv) instanceof S3ObjectStorage, true);
});

test("provider-qualified media keys resolve only safe local or S3 object names", () => {
  assert.equal(objectNameForStorageKey("local:med-12345678-abcd.png"), "med-12345678-abcd.png");
  assert.equal(objectNameForStorageKey("s3:med-12345678-abcd.png"), "med-12345678-abcd.png");
  assert.equal(objectNameForStorageKey("external:hash"), null);
  assert.equal(objectNameForStorageKey("s3:../private.png"), null);
  assert.equal(objectNameForStorageKey("s3:bad name.png"), null);
});

test("local storage refuses path traversal names", async () => {
  const storage = new LocalDiskStorage("/tmp/shahoo-media-test");
  await assert.rejects(() => storage.put("../escape.jpg", new Uint8Array([1])), /unsafe_name/);
});
