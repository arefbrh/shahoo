import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { otpEchoAllowed } from "../env/runtime.ts";
import { resolveSmsProvider } from "../sms/providers.ts";

/** Keep in sync with scripts/hash-admin-password.mjs */
export const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

const HASH_RE = /^s2\$[A-Za-z0-9_-]{16,}\$[A-Za-z0-9_-]{40,}$/;

export function isSecretHash(stored: string): boolean {
  return HASH_RE.test(stored);
}

export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, 32, SCRYPT_OPTIONS);
  return `s2$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  if (!isSecretHash(stored)) return false;
  const [, saltPart, hashPart] = stored.split("$");
  const salt = Buffer.from(saltPart ?? "", "base64url");
  const expected = Buffer.from(hashPart ?? "", "base64url");
  if (salt.length < 8 || expected.length !== 32) return false;
  const actual = scryptSync(secret, salt, expected.length, SCRYPT_OPTIONS);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function newOtpCode(): string {
  return String(randomInt(0, 100_000)).padStart(5, "0");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function smsIsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (resolveSmsProvider(env) !== null) return true;
  if (env.SMS_MODE?.trim()) return false;
  if (env.NODE_ENV === "production") return false;
  const provider = env.SMS_PROVIDER?.trim().toLowerCase();
  if (provider === "smsir" || provider === "sms.ir") return Boolean((env.SMS_IR_API_KEY?.trim() || env.SMS_API_KEY?.trim()) && env.SMS_IR_OTP_TEMPLATE_ID?.trim());
  return Boolean(env.SMS_API_KEY?.trim() && provider);
}

/** Plaintext OTP reaches the browser only when ECHO_OTP=1, outside production, and SMS is not configured. */
export function shouldEchoOtp(env: NodeJS.ProcessEnv = process.env): boolean {
  return otpEchoAllowed(env);
}
