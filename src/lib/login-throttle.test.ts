import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_LOCK_AFTER,
  ACCOUNT_LOCK_MS,
  ACCOUNT_WINDOW_MS,
  auditPlan,
  canDeleteThrottleRow,
  failureDelayMs,
  IP_LOCK_AFTER,
  IP_LOCK_MS,
  IP_WINDOW_MS,
  isLocked,
  loginFailureMessage,
  nextAfterFailure,
  prepareThrottle,
  resolveClientIp,
  type ThrottleState,
} from "./login-throttle.ts";

const fresh: ThrottleState = { failures: 0, lockedUntil: null, lastFailureAt: null, auditsWritten: 0 };

function failuresWithin(kind: "account" | "ip", count: number, now: number): ThrottleState {
  let state = fresh;
  for (let attempt = 0; attempt < count; attempt += 1) {
    const next = nextAfterFailure(state, now + attempt * 1000, kind);
    const prepared = prepareThrottle(state, now + attempt * 1000, kind);
    const plan = auditPlan(prepared, next);
    if (plan !== "none") next.auditsWritten += 1;
    state = next;
  }
  return state;
}

test("five failures inside the account window lock for 15 minutes", () => {
  const now = 5_000_000;
  const state = failuresWithin("account", ACCOUNT_LOCK_AFTER - 1, now);
  assert.equal(state.lockedUntil, null);
  assert.equal(state.failures, 4);
  const locked = nextAfterFailure(state, now + 4_000, "account");
  assert.equal(locked.lockedUntil, now + 4_000 + ACCOUNT_LOCK_MS);
  assert.equal(isLocked(locked, now + 5_000), true);
  assert.equal(auditPlan(state, locked), "lock");
  assert.equal(loginFailureMessage(false).includes("فعال نشده"), false);
  assert.notEqual(loginFailureMessage(true), loginFailureMessage(false));
});

test("account failures outside the 15-minute window start again", () => {
  const start = 1_000_000;
  const stale = failuresWithin("account", 4, start);
  const at = (stale.lastFailureAt ?? start) + ACCOUNT_WINDOW_MS;
  const next = nextAfterFailure(stale, at, "account");
  assert.equal(next.failures, 1);
  assert.equal(next.lockedUntil, null);
  assert.equal(next.auditsWritten, 0);
  assert.equal(auditPlan(prepareThrottle(stale, at, "account"), next), "failure");
});

test("ip failures use a 30-minute window and lock on the 20th", () => {
  const now = 8_000_000;
  const state = failuresWithin("ip", IP_LOCK_AFTER - 1, now);
  assert.equal(state.lockedUntil, null);
  const locked = nextAfterFailure(state, now + 19_000, "ip");
  assert.equal(locked.lockedUntil, now + 19_000 + IP_LOCK_MS);
  const stale = nextAfterFailure(locked, now + IP_WINDOW_MS + IP_LOCK_MS, "ip");
  assert.equal(stale.failures, 1);
  assert.equal(stale.lockedUntil, null);
});

test("an active lock is not cleared when the failure window has elapsed", () => {
  const now = 2_000_000;
  const locked: ThrottleState = {
    failures: 5,
    lockedUntil: now + 60_000,
    lastFailureAt: now - ACCOUNT_WINDOW_MS * 3,
    auditsWritten: 4,
  };
  const prepared = prepareThrottle(locked, now, "account");
  assert.equal(prepared.failures, 5);
  assert.equal(prepared.lockedUntil, locked.lockedUntil);
  assert.equal(nextAfterFailure(locked, now, "account").failures, 5);
  assert.equal(canDeleteThrottleRow(locked, now, "account"), false);
});

test("expired locks and expired windows can be deleted", () => {
  const now = 9_000_000;
  const expiredLock: ThrottleState = {
    failures: 5,
    lockedUntil: now - 1,
    lastFailureAt: now - ACCOUNT_LOCK_MS,
    auditsWritten: 4,
  };
  assert.equal(canDeleteThrottleRow(expiredLock, now, "account"), true);
  assert.equal(prepareThrottle(expiredLock, now, "account").failures, 0);
  const openWindow: ThrottleState = { failures: 2, lockedUntil: null, lastFailureAt: now - 1000, auditsWritten: 2 };
  assert.equal(canDeleteThrottleRow(openWindow, now, "ip"), false);
  const oldWindow: ThrottleState = { failures: 2, lockedUntil: null, lastFailureAt: now - IP_WINDOW_MS, auditsWritten: 2 };
  assert.equal(canDeleteThrottleRow(oldWindow, now, "ip"), true);
  assert.equal(canDeleteThrottleRow(oldWindow, now, "account"), true);
});

test("a successful login may drop an expired ip bucket but not an open one", () => {
  const now = 4_000_000;
  const openIp: ThrottleState = { failures: 3, lockedUntil: null, lastFailureAt: now - 1000, auditsWritten: 3 };
  assert.equal(canDeleteThrottleRow(openIp, now, "ip"), false);
  const expiredIp: ThrottleState = { failures: 3, lockedUntil: null, lastFailureAt: now - IP_WINDOW_MS, auditsWritten: 3 };
  assert.equal(canDeleteThrottleRow(expiredIp, now, "ip"), true);
});

test("forged forwarding headers are ignored unless the proxy is trusted", () => {
  assert.equal(failureDelayMs(1), 0);
  assert.equal(failureDelayMs(3), 400);
  assert.equal(failureDelayMs(12), 4000);
  assert.equal(resolveClientIp({ trustProxy: false, forwardedFor: "9.9.9.9", socketAddress: "203.0.113.8" }), "203.0.113.8");
  assert.equal(resolveClientIp({ trustProxy: false, forwardedFor: "9.9.9.9", socketAddress: null }), null);
  assert.equal(
    resolveClientIp({ trustProxy: true, forwardedFor: "198.51.100.4, 203.0.113.8", socketAddress: "203.0.113.8" }),
    "198.51.100.4",
  );
  assert.equal(resolveClientIp({ trustProxy: true, forwardedFor: "not-an-ip", socketAddress: "203.0.113.8" }), "203.0.113.8");
  assert.equal(resolveClientIp({ trustProxy: true, forwardedFor: "not-an-ip", socketAddress: null }), null);
});
