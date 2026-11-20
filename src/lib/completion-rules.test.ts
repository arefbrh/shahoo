import assert from "node:assert/strict";
import test from "node:test";
import { parseAddress } from "./address-rules.ts";
import { sniffImage } from "./media-bytes.ts";
import { sanitizeImage } from "../server/media/sanitize-image.ts";
import { finishReturnAction, replaceReturnQueue, applyReturnAction } from "./return-desk.ts";
import { canManuallyMove, canReviewReturn, canSettlePaidCancel, orderStatusAfterRefund, refundAmount } from "./order-flow.ts";
import { nextOtpBucket } from "./otp-bucket.ts";
import { securityHeaders } from "./security-headers.ts";
import { localStorageAllowed } from "../server/media/disk.ts";
import { resolveSmsProvider, smsLive } from "../server/sms/providers.ts";

test("address rules accept an Iranian postal code and reject a short street", () => {
  const ok = parseAddress({
    label: "خانه",
    recipientName: "آزاده رضایی",
    recipientMobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان ولیعصر، کوچه بهار",
    postalCode: "۱۲۳۴۵۶۷۸۹۰",
    plaque: "۱۲",
    unit: "",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.postalCode, "1234567890");
  const bad = parseAddress({ ...{ label: "", recipientName: "آزاده رضایی", recipientMobile: "09120000001", province: "تهران", city: "تهران", addressLine: "کوتاه", postalCode: "123", plaque: "", unit: "" } });
  assert.equal(bad.ok, false);
});

test("paid is not a manual status and refunds stay inside the order total", () => {
  assert.equal(canManuallyMove("awaiting_payment", "paid", "unpaid"), false);
  assert.equal(canManuallyMove("awaiting_payment", "cancelled", "unpaid"), true);
  assert.equal(canManuallyMove("paid", "cancelled", "verified"), false);
  assert.equal(canManuallyMove("paid", "processing", "verified"), true);
  assert.equal(canSettlePaidCancel("paid", "verified"), true);
  assert.equal(canSettlePaidCancel("awaiting_payment", "unpaid"), false);
  const full = refundAmount(1000, "full", 0, 0);
  assert.equal(full.ok && full.amountIrr, 1000);
  const partial = refundAmount(1000, "partial", 400, 0);
  assert.equal(partial.ok && partial.amountIrr, 400);
  assert.equal(orderStatusAfterRefund("partial", 400, 1000, 0), "partially_refunded");
  assert.equal(refundAmount(1000, "partial", 700, 400).ok, false);
});

test("otp buckets reset after the window and image bytes reject text", () => {
  const first = nextOtpBucket(1_000, null, { windowMs: 1000, max: 2, cooldownMs: 0 });
  assert.equal(first.ok, true);
  const blocked = nextOtpBucket(1_100, { hits: 2, windowStartedAt: 1_000, lastRequestAt: 1_050 }, { windowMs: 1000, max: 2, cooldownMs: 0 });
  assert.equal(blocked.ok, false);
  const reset = nextOtpBucket(3_000, { hits: 2, windowStartedAt: 1_000, lastRequestAt: 1_050 }, { windowMs: 1000, max: 2, cooldownMs: 0 });
  assert.equal(reset.ok, true);
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime, "image/jpeg");
  assert.equal(sniffImage(new TextEncoder().encode("<svg></svg>    ")), null);
  const huge = new Uint8Array(4 * 1024 * 1024 + 1);
  huge[0] = 0xff;
  huge[1] = 0xd8;
  huge[2] = 0xff;
  assert.equal(sniffImage(huge), null);
  assert.equal(smsLive({ NODE_ENV: "production", SMS_PROVIDER: "kavenegar", SMS_API_KEY: "x" } as NodeJS.ProcessEnv), false);
  assert.equal(resolveSmsProvider({ NODE_ENV: "production", SMS_LIVE: "1", SMS_PROVIDER: "mock", SMS_API_KEY: "x" } as NodeJS.ProcessEnv), null);
});

test("security headers stay strict unless the preview flag is explicit", () => {
  const dev = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
  const http = securityHeaders(false, dev);
  assert.equal("Strict-Transport-Security" in http, false);
  assert.doesNotMatch(http["Content-Security-Policy"], /unsafe-eval/);
  assert.doesNotMatch(http["Content-Security-Policy"], /frame-ancestors[^;]*grok/);
  const preview = securityHeaders(false, { NODE_ENV: "development", ALLOW_DEV_CSP: "1" } as NodeJS.ProcessEnv);
  assert.match(preview["Content-Security-Policy"], /https:\/\/grok\.com/);
  assert.match(preview["Content-Security-Policy"], /unsafe-eval/);
  const forced = securityHeaders(true, { NODE_ENV: "production", ALLOW_DEV_CSP: "1" } as NodeJS.ProcessEnv);
  assert.equal(forced["Strict-Transport-Security"]?.includes("max-age"), true);
  assert.doesNotMatch(forced["Content-Security-Policy"], /unsafe-eval/);
  assert.doesNotMatch(forced["Content-Security-Policy"], /script-src[^;]*https:\/\/grok\.com/);
  assert.match(forced["Content-Security-Policy"], /frame-ancestors 'self'/);
  assert.match(forced["Content-Security-Policy"], /unsafe-inline/);
  assert.match(forced["Permissions-Policy"], /camera=\(\)/);
  assert.equal(http["X-Content-Type-Options"], "nosniff");
  assert.equal(localStorageAllowed(dev), true);
  assert.equal(localStorageAllowed({ NODE_ENV: "production" } as NodeJS.ProcessEnv), false);
  assert.equal(localStorageAllowed({ NODE_ENV: "production", STORAGE_PROVIDER: "local" } as NodeJS.ProcessEnv), false);
  assert.equal(localStorageAllowed({ NODE_ENV: "production", ALLOW_LOCAL_STORAGE: "true" } as NodeJS.ProcessEnv), true);
  assert.equal(localStorageAllowed({ NODE_ENV: "production", ALLOW_LOCAL_STORAGE: "true", STORAGE_PROVIDER: "s3" } as NodeJS.ProcessEnv), false);
  assert.equal(resolveSmsProvider({ NODE_ENV: "development", SMS_PROVIDER: "mock", ALLOW_MOCK_SMS: "1" } as NodeJS.ProcessEnv)?.key, "mock");
  assert.equal(resolveSmsProvider({ NODE_ENV: "production", SMS_PROVIDER: "mock", ALLOW_MOCK_SMS: "1", SMS_LIVE: "1", SMS_API_KEY: "x" } as NodeJS.ProcessEnv), null);
});

test("return transitions stay on the legal path", () => {
  assert.equal(canReviewReturn("requested", "approved"), true);
  assert.equal(canReviewReturn("requested", "received"), false);
  assert.equal(canReviewReturn("reviewing", "rejected"), true);
  assert.equal(canReviewReturn("approved", "received"), true);
  assert.equal(canReviewReturn("rejected", "approved"), false);
  assert.equal(canReviewReturn("received", "reviewing"), false);
  const rows = [{ id: "ret-1", status: "requested" }];
  const approved = applyReturnAction(rows, "ret-1", "approved");
  assert.equal(approved.updated, true);
  assert.equal(approved.rows[0]?.status, "approved");
  assert.equal(rows[0]?.status, "requested");
  const missing = applyReturnAction(rows, "missing", "rejected");
  assert.equal(missing.updated, false);
  assert.equal(missing.rows[0]?.status, "requested");
  const previous = [{ id: "ret-1", status: "requested", orderStatus: "delivered", history: [] as { status: string }[] }];
  const failed = finishReturnAction(previous, { ok: false, message: "این تغییر وضعیت مرجوعی مجاز نیست." });
  assert.equal(failed.error, "این تغییر وضعیت مرجوعی مجاز نیست.");
  assert.equal(failed.rows[0]?.status, "requested");
  assert.equal(previous[0]?.status, "requested");
  const saved = finishReturnAction(previous, {
    ok: true,
    row: { id: "ret-1", status: "approved", orderStatus: "delivered", history: [{ status: "approved" }] },
  });
  assert.equal(saved.error, null);
  assert.equal(saved.rows[0]?.status, "approved");
  assert.equal(saved.rows[0]?.history[0]?.status, "approved");
  assert.equal(previous[0]?.status, "requested");
  const reloaded = replaceReturnQueue(saved.rows, {
    ok: true,
    rows: [{ id: "ret-1", status: "received", orderStatus: "returned", history: [{ status: "received" }] }],
  });
  assert.equal(reloaded.rows[0]?.orderStatus, "returned");
  const kept = replaceReturnQueue(saved.rows, { ok: false, message: "فهرست مرجوعی خوانده نشد." });
  assert.equal(kept.rows[0]?.status, "approved");
  assert.equal(kept.error, "فهرست مرجوعی خوانده نشد.");
});

test("image sanitize rebuilds a real file and drops a trailing payload", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const payload = new Uint8Array(png.length + 16);
  payload.set(png);
  payload.set(new TextEncoder().encode("<script>"), png.length);
  const clean = sanitizeImage(payload);
  assert.ok(clean);
  assert.equal(clean?.ext, "png");
  assert.equal(Buffer.from(clean?.bytes ?? []).includes("<script>"), false);
  const jpeg = Uint8Array.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
    0x3f, 0x00, 0x00, 0xff, 0xd9, 0x3c, 0x3f, 0x70, 0x68, 0x70,
  ]);
  assert.equal(sanitizeImage(jpeg), null);
  const real = Buffer.from(
    "ffd8ffe000104a46494600010100000100010000ffdb00430006040506050406060506070706080a100a0a09090a140e0f0c1017141818171416161a1d251f1a1b231c1616202c20232627292a29191f2d302d283025282928ffdb0043010707070a080a130a0a13281a161a2828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00f1ea28a2b94f9c3fffd9",
    "hex",
  );
  const trailed = new Uint8Array(real.length + 8);
  trailed.set(real);
  trailed.set(new TextEncoder().encode("<script>"), real.length);
  const rebuilt = sanitizeImage(trailed);
  assert.equal(rebuilt?.ext, "jpg");
  assert.equal(rebuilt?.bytes[0], 0xff);
  assert.equal(rebuilt?.bytes[1], 0xd8);
  assert.equal(rebuilt?.bytes.at(-2), 0xff);
  assert.equal(rebuilt?.bytes.at(-1), 0xd9);
  assert.equal(Buffer.from(rebuilt?.bytes ?? []).includes("<script>"), false);
  const gif = Buffer.from("474946383761010001008100000c50280000000000000000002c000000000100010000080400010404003b", "hex");
  assert.equal(sanitizeImage(gif)?.ext, "gif");
  const brokenGif = Uint8Array.from(gif);
  brokenGif[brokenGif.lastIndexOf(0x2c) + 10] = 0;
  assert.equal(sanitizeImage(brokenGif), null);
});
