export type OtpBucket = {
  hits: number;
  windowStartedAt: number;
  lastRequestAt: number | null;
};

export type OtpBucketDecision =
  | { ok: true; next: OtpBucket }
  | { ok: false; reason: "cooldown" | "window"; retryAfterSec: number };

export function nextOtpBucket(
  nowMs: number,
  current: OtpBucket | null,
  limits: { windowMs: number; max: number; cooldownMs: number },
): OtpBucketDecision {
  if (!current) {
    return { ok: true, next: { hits: 1, windowStartedAt: nowMs, lastRequestAt: nowMs } };
  }
  if (limits.cooldownMs > 0 && current.lastRequestAt !== null && nowMs - current.lastRequestAt < limits.cooldownMs) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSec: Math.max(1, Math.ceil((limits.cooldownMs - (nowMs - current.lastRequestAt)) / 1000)),
    };
  }
  const expired = nowMs - current.windowStartedAt >= limits.windowMs;
  if (!expired && current.hits >= limits.max) {
    return {
      ok: false,
      reason: "window",
      retryAfterSec: Math.max(1, Math.ceil((limits.windowMs - (nowMs - current.windowStartedAt)) / 1000)),
    };
  }
  if (expired) return { ok: true, next: { hits: 1, windowStartedAt: nowMs, lastRequestAt: nowMs } };
  return {
    ok: true,
    next: { hits: current.hits + 1, windowStartedAt: current.windowStartedAt, lastRequestAt: nowMs },
  };
}
