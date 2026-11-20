import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashSecret, hashSessionToken, isSecretHash, newSessionToken, shouldEchoOtp, smsIsConfigured, verifySecret } from "./crypto.ts";
import { maskIdentifier, maskMobile, normalizeIranMobile, normalizeOtpCode } from "./mobile.ts";
import { decideOtpSend, OTP_MAX_IN_WINDOW, OTP_RESEND_MS, OTP_WINDOW_MS } from "./policy.ts";

describe("iran mobile", () => {
  it("accepts local, country, and persian digits", () => {
    assert.equal(normalizeIranMobile("09123456789"), "09123456789");
    assert.equal(normalizeIranMobile("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
    assert.equal(normalizeIranMobile("+98 912 345 6789"), "09123456789");
    assert.equal(normalizeIranMobile("00989123456789"), "09123456789");
    assert.equal(normalizeIranMobile("9123456789"), "09123456789");
  });

  it("rejects short or foreign numbers", () => {
    assert.equal(normalizeIranMobile("02112345678"), null);
    assert.equal(normalizeIranMobile("091234567"), null);
    assert.equal(normalizeIranMobile("hello"), null);
  });

  it("normalizes a five-digit code", () => {
    assert.equal(normalizeOtpCode("۱۲۳۴۵"), "12345");
    assert.equal(normalizeOtpCode("1234"), null);
  });
});

describe("otp policy", () => {
  it("blocks a resend inside the cooldown", () => {
    const now = 1_000_000;
    const decision = decideOtpSend(now, [now - 10_000]);
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.reason, "cooldown");
  });

  it("blocks the window after the cooldown has passed", () => {
    const now = 5_000_000;
    const stamps = Array.from({ length: OTP_MAX_IN_WINDOW }, (_, index) => now - OTP_RESEND_MS - index * 1000);
    const decision = decideOtpSend(now, stamps);
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.reason, "window");
      assert.ok(decision.retryAfterSec > 0);
      assert.ok(decision.retryAfterSec <= OTP_WINDOW_MS / 1000);
    }
  });

  it("allows a fresh request", () => {
    assert.deepEqual(decideOtpSend(10_000, []), { ok: true });
  });
});

describe("secrets", () => {
  it("hashes and verifies without keeping the secret", () => {
    const stored = hashSecret("12345");
    assert.equal(isSecretHash(stored), true);
    assert.equal(stored.includes("12345"), false);
    assert.equal(verifySecret("12345", stored), true);
    assert.equal(verifySecret("12346", stored), false);
    assert.equal(verifySecret("12345", "not-a-hash"), false);
  });

  it("hashes session tokens", () => {
    const token = newSessionToken();
    assert.equal(hashSessionToken(token), hashSessionToken(token));
    assert.notEqual(token, hashSessionToken(token));
  });

  it("never echoes an otp code unless the development flag is set", () => {
    assert.equal(shouldEchoOtp({ NODE_ENV: "production" } as NodeJS.ProcessEnv), false);
    assert.equal(shouldEchoOtp({ NODE_ENV: "production", ECHO_OTP: "1" } as NodeJS.ProcessEnv), false);
    assert.equal(shouldEchoOtp({ NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
    assert.equal(shouldEchoOtp({ NODE_ENV: "development", ECHO_OTP: "1" } as NodeJS.ProcessEnv), true);
    assert.equal(smsIsConfigured({ SMS_API_KEY: "key", SMS_PROVIDER: "kavenegar" } as NodeJS.ProcessEnv), true);
    assert.equal(smsIsConfigured({ SMS_PROVIDER: "smsir", SMS_IR_API_KEY: "key", SMS_IR_OTP_TEMPLATE_ID: "123" } as NodeJS.ProcessEnv), true);
    assert.equal(smsIsConfigured({ NODE_ENV: "development", SMS_PROVIDER: "mock", ALLOW_MOCK_SMS: "1" } as NodeJS.ProcessEnv), true);
    assert.equal(smsIsConfigured({ NODE_ENV: "production", SMS_PROVIDER: "mock", ALLOW_MOCK_SMS: "1" } as NodeJS.ProcessEnv), false);
    assert.equal(
      shouldEchoOtp({ NODE_ENV: "development", ECHO_OTP: "1", SMS_API_KEY: "key", SMS_PROVIDER: "kavenegar" } as NodeJS.ProcessEnv),
      false,
    );
  });
});

describe("masking", () => {
  it("hides the middle of a mobile and the local part of an email", () => {
    assert.equal(maskMobile("09123456789"), "0912***6789");
    assert.equal(maskIdentifier("09123456789"), "0912***6789");
    assert.equal(maskIdentifier("owner@shahoo.test"), "o***@shahoo.test");
    assert.equal(maskIdentifier("not an id"), "نامشخص");
  });
});
