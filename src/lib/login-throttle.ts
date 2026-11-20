/**
 * Admin login throttle policy.
 *
 * Account: 5 failures inside 15 minutes, then a 15-minute lock.
 * IP: 20 failures inside 30 minutes, then a 30-minute lock.
 * The window is measured from last_failure_at. When it expires, the failure
 * counter and the audit counter start over. An active lock is never cleared
 * early just because the failure window has also elapsed.
 *
 * Success: delete the account bucket. Keep an open IP bucket and any active
 * IP lock. One correct password must not refill a shared address's budget.
 * An IP row whose window or lock has already expired may be deleted.
 *
 * SHAHOO_TRUST_PROXY: set to "1" only when a reverse proxy overwrites
 * X-Forwarded-For with the real client address and drops any value the
 * client sent. Otherwise the header is ignored. A missing socket address
 * does not fall back to a shared global bucket.
 */

export const ACCOUNT_LOCK_AFTER = 5;
export const IP_LOCK_AFTER = 20;
export const ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
export const IP_WINDOW_MS = 30 * 60 * 1000;
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
export const IP_LOCK_MS = 30 * 60 * 1000;
export const FAILURE_AUDITS_MAX = 3;
export const MAX_DELAY_MS = 4_000;

export const ADMIN_LOGIN_FAIL = "اطلاعات ورود درست نیست.";
export const ADMIN_LOGIN_LOCK = "تلاش‌های ورود موقتاً محدود شده است. کمی بعد دوباره امتحان کنید.";

export type ThrottleKind = "account" | "ip";

export type ThrottleState = {
  failures: number;
  lockedUntil: number | null;
  lastFailureAt: number | null;
  auditsWritten: number;
};

const EMPTY: ThrottleState = { failures: 0, lockedUntil: null, lastFailureAt: null, auditsWritten: 0 };

export function windowMs(kind: ThrottleKind): number {
  return kind === "account" ? ACCOUNT_WINDOW_MS : IP_WINDOW_MS;
}

export function loginFailureMessage(locked: boolean): string {
  return locked ? ADMIN_LOGIN_LOCK : ADMIN_LOGIN_FAIL;
}

export function isLocked(state: ThrottleState, now: number): boolean {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

export function prepareThrottle(state: ThrottleState, now: number, kind: ThrottleKind): ThrottleState {
  if (isLocked(state, now)) return state;
  if (state.lockedUntil !== null && state.lockedUntil <= now) return { ...EMPTY };
  if (state.lastFailureAt === null || now - state.lastFailureAt >= windowMs(kind)) return { ...EMPTY };
  return state;
}

export function normalizeThrottle(state: ThrottleState, now: number, kind: ThrottleKind = "account"): ThrottleState {
  return prepareThrottle(state, now, kind);
}

/** True when cleanup may delete the row. Active locks and open windows stay. */
export function canDeleteThrottleRow(state: ThrottleState, now: number, kind: ThrottleKind): boolean {
  if (isLocked(state, now)) return false;
  const prepared = prepareThrottle(state, now, kind);
  return prepared.failures === 0 && prepared.lockedUntil === null;
}

export function failureDelayMs(failures: number): number {
  if (failures < 3) return 0;
  return Math.min(MAX_DELAY_MS, 100 * 2 ** (failures - 1));
}

export function nextAfterFailure(state: ThrottleState, now: number, kind: ThrottleKind): ThrottleState {
  const current = prepareThrottle(state, now, kind);
  if (isLocked(current, now)) return current;
  const failures = current.failures + 1;
  const limit = kind === "account" ? ACCOUNT_LOCK_AFTER : IP_LOCK_AFTER;
  const lockMs = kind === "account" ? ACCOUNT_LOCK_MS : IP_LOCK_MS;
  return {
    failures,
    lockedUntil: failures >= limit ? now + lockMs : null,
    lastFailureAt: now,
    auditsWritten: current.auditsWritten,
  };
}

/** At most a few failure rows, then one lock row. Further tries write nothing. */
export function auditPlan(before: ThrottleState, after: ThrottleState): "failure" | "lock" | "none" {
  const becameLocked = after.lockedUntil !== null && before.lockedUntil === null;
  if (becameLocked) return "lock";
  if (before.auditsWritten < FAILURE_AUDITS_MAX) return "failure";
  return "none";
}

const IP_V4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IP_V6 = /^[0-9a-fA-F:]{2,64}$/;

function plausibleIp(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  if (text.length < 3 || text.length > 64) return null;
  if (IP_V4.test(text)) {
    const parts = text.split(".").map(Number);
    if (parts.some((part) => part > 255)) return null;
    return text;
  }
  if (!text.includes(":") || !IP_V6.test(text)) return null;
  return text.toLowerCase();
}

/**
 * Client-supplied forwarding headers count only when SHAHOO_TRUST_PROXY=1
 * and the proxy sanitizes them. Without that flag, or without a socket
 * address, a forged X-Forwarded-For is not a throttle key.
 */
export function resolveClientIp(input: {
  trustProxy: boolean;
  forwardedFor: string | null;
  socketAddress: string | null;
}): string | null {
  const socket = plausibleIp(input.socketAddress);
  if (!input.trustProxy) return socket;
  const forwarded = plausibleIp(input.forwardedFor?.split(",")[0] ?? null);
  return forwarded ?? socket;
}
