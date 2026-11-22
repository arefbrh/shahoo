import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeImage } from "./sanitize-image.ts";

const onePixelGif = Uint8Array.from([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
  0x00,0x00,0x00,0xff,0xff,0xff,
  0x21,0xf9,0x04,0x01,0x00,0x00,0x00,0x00,
  0x2c,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,
  0x02,0x02,0x44,0x01,0x00,0x3b,
]);

test("GIF sanitizer accepts a valid one-pixel frame and rebuilds only through trailer", () => {
  const result = sanitizeImage(onePixelGif);
  assert.ok(result);
  assert.equal(result.mime, "image/gif");
  assert.deepEqual(result.bytes, onePixelGif);
});

test("GIF sanitizer rejects frames extending outside the logical canvas", () => {
  const malformed = onePixelGif.slice();
  malformed[28] = 1;
  assert.equal(sanitizeImage(malformed), null);
});

test("GIF sanitizer rejects LZW output that does not match the frame pixel count", () => {
  const malformed = onePixelGif.slice();
  malformed[39] = 0x4c;
  malformed[40] = 0x0a;
  assert.equal(sanitizeImage(malformed), null);
});
