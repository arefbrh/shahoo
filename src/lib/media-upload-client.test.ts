import assert from "node:assert/strict";
import test from "node:test";
import { MAX_IMAGE_BYTES } from "./media-bytes.ts";
import { UPLOAD_MESSAGES, uploadMedia, validateUploadFile } from "./media-upload-client.ts";

test("file checks give understandable Persian messages", () => {
  assert.equal(validateUploadFile(null), UPLOAD_MESSAGES.none);
  assert.equal(validateUploadFile({ type: "image/png", size: 0 }), UPLOAD_MESSAGES.empty);
  assert.equal(validateUploadFile({ type: "application/pdf", size: 100 }), UPLOAD_MESSAGES.type);
  assert.equal(validateUploadFile({ type: "image/svg+xml", size: 100 }), UPLOAD_MESSAGES.type);
  assert.equal(validateUploadFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 }), UPLOAD_MESSAGES.size);
  assert.equal(validateUploadFile({ type: "image/webp", size: MAX_IMAGE_BYTES }), UPLOAD_MESSAGES.type);
  assert.equal(validateUploadFile({ type: "image/jpeg", size: 1234 }), null);
});

const reply = (body: unknown) => async () => ({ json: async () => body });

test("success is reported only when the server answers ok: true", async () => {
  assert.deepEqual(await uploadMedia(reply({ ok: true }), "f"), { ok: true });
  for (const body of [{ ok: false }, {}, null, { ok: "true" }, { ok: 1 }]) {
    const result = await uploadMedia(reply(body), "f");
    assert.equal(result.ok, false, JSON.stringify(body));
  }
});

test("server refusal text is shown; an empty one falls back to a Persian message", async () => {
  const shown = await uploadMedia(reply({ ok: false, message: "فقط تصویر سالم پذیرفته می‌شود." }), "f");
  assert.deepEqual(shown, { ok: false, message: "فقط تصویر سالم پذیرفته می‌شود." });
  const fallback = await uploadMedia(reply({ ok: false, message: "  " }), "f");
  assert.deepEqual(fallback, { ok: false, message: UPLOAD_MESSAGES.failed });
});

test("a network failure then a retry: first fails safely, second succeeds", async () => {
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("network down");
    return { json: async () => ({ ok: true }) };
  };
  const first = await uploadMedia(flaky, "form");
  assert.deepEqual(first, { ok: false, message: UPLOAD_MESSAGES.failed });
  const second = await uploadMedia(flaky, "form");
  assert.deepEqual(second, { ok: true });
  assert.equal(calls, 2);
});

test("an unreadable reply is not treated as an upload", async () => {
  const bad = async () => ({
    json: async () => {
      throw new SyntaxError("Unexpected token <");
    },
  });
  assert.deepEqual(await uploadMedia(bad, "f"), { ok: false, message: UPLOAD_MESSAGES.badReply });
});

test("technical error text never reaches the message", async () => {
  const boom = async () => {
    throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
  };
  const result = await uploadMedia(boom, "f");
  assert.equal(result.ok, false);
  if (!result.ok) assert.doesNotMatch(result.message, /ECONN|5432|10\.0/);
});
