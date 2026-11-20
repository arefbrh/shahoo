export const OTP_LENGTH = 5;
export const OTP_TTL_MS = 2 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_MS = 60 * 1000;
export const OTP_WINDOW_MS = 15 * 60 * 1000;
export const OTP_MAX_IN_WINDOW = 5;
export const CUSTOMER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
export const LOGIN_PURPOSE = "login";

export type OtpSendDecision =
  | { ok: true }
  | { ok: false; reason: "cooldown" | "window"; retryAfterSec: number };

export function decideOtpSend(nowMs: number, createdAtMs: number[]): OtpSendDecision {
  if (createdAtMs.length === 0) return { ok: true };
  const latest = Math.max(...createdAtMs);
  if (nowMs - latest < OTP_RESEND_MS) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSec: Math.max(1, Math.ceil((OTP_RESEND_MS - (nowMs - latest)) / 1000)),
    };
  }
  const inWindow = createdAtMs.filter((stamp) => nowMs - stamp < OTP_WINDOW_MS);
  if (inWindow.length >= OTP_MAX_IN_WINDOW) {
    const oldest = Math.min(...inWindow);
    return {
      ok: false,
      reason: "window",
      retryAfterSec: Math.max(1, Math.ceil((OTP_WINDOW_MS - (nowMs - oldest)) / 1000)),
    };
  }
  return { ok: true };
}
