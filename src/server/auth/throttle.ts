import { and, eq, sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../db/schema.ts";
import { createHash } from "node:crypto";
import {
  ACCOUNT_WINDOW_MS,
  auditPlan,
  canDeleteThrottleRow,
  IP_WINDOW_MS,
  isLocked,
  nextAfterFailure,
  prepareThrottle,
  type ThrottleKind,
  type ThrottleState,
} from "../../lib/login-throttle.ts";
import { authThrottle } from "../db/schema.ts";

type Database = PgliteDatabase<typeof schema>;
type Query = Pick<Database, "insert" | "select" | "update" | "delete" | "execute">;

const EMPTY: ThrottleState = { failures: 0, lockedUntil: null, lastFailureAt: null, auditsWritten: 0 };

export type FailureRecord = {
  state: ThrottleState;
  audit: "failure" | "lock" | "none";
  alreadyLocked: boolean;
};

function millis(value: Date | string | number | null): number | null {
  if (value === null) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function toState(row: {
  failures: number;
  lockedUntil: Date | string | null;
  lastFailureAt: Date | string | null;
  auditsWritten: number;
}): ThrottleState {
  return {
    failures: row.failures,
    lockedUntil: millis(row.lockedUntil),
    lastFailureAt: millis(row.lastFailureAt),
    auditsWritten: row.auditsWritten,
  };
}

export function throttleSubject(scope: string, value: string): string {
  return createHash("sha256").update(`${scope}\n${value}`).digest("hex");
}

export function accountKey(identifier: string, mobile: string | null): string {
  return mobile ?? identifier.trim().toLowerCase();
}

export async function readThrottle(db: Query, scope: string, subjectHash: string): Promise<ThrottleState> {
  const [row] = await db
    .select()
    .from(authThrottle)
    .where(and(eq(authThrottle.scope, scope), eq(authThrottle.subjectHash, subjectHash)))
    .limit(1);
  if (!row) return { ...EMPTY };
  return toState(row);
}

/**
 * Deletes rows whose lock and failure window are both over.
 * Called from the server login path. This runtime has no durable scheduler;
 * a deploy cron may call the same function, but login does not depend on it.
 * Active locks and open windows are kept.
 */
export async function cleanupExpiredThrottle(db: Query, now: number): Promise<number> {
  const nowDate = new Date(now);
  const accountCutoff = new Date(now - ACCOUNT_WINDOW_MS);
  const ipCutoff = new Date(now - IP_WINDOW_MS);
  const result = await db.execute(sql`
    delete from auth_throttle
    where (locked_until is null or locked_until <= ${nowDate})
      and (
        (scope = 'admin_login_account' and (last_failure_at is null or last_failure_at <= ${accountCutoff}))
        or (scope = 'admin_login_ip' and (last_failure_at is null or last_failure_at <= ${ipCutoff}))
      )
    returning scope
  `);
  const rows = Array.isArray(result) ? result : result.rows;
  return rows.length;
}

async function writeFailure(
  tx: Query,
  scope: "admin_login_account" | "admin_login_ip",
  subjectHash: string,
  now: number,
): Promise<FailureRecord> {
  const kind: ThrottleKind = scope === "admin_login_account" ? "account" : "ip";
  const nowDate = new Date(now);
  await tx
    .insert(authThrottle)
    .values({ scope, subjectHash, failures: 0, auditsWritten: 0, updatedAt: nowDate })
    .onConflictDoNothing({ target: [authThrottle.scope, authThrottle.subjectHash] });
  const [row] = await tx
    .select()
    .from(authThrottle)
    .where(and(eq(authThrottle.scope, scope), eq(authThrottle.subjectHash, subjectHash)))
    .for("update");
  if (!row) throw new Error("throttle row missing");
  const before = toState(row);
  const prepared = prepareThrottle(before, now, kind);
  if (isLocked(prepared, now)) return { state: prepared, audit: "none", alreadyLocked: true };
  const next = nextAfterFailure(before, now, kind);
  const audit = auditPlan(prepared, next);
  if (audit !== "none") next.auditsWritten += 1;
  await tx
    .update(authThrottle)
    .set({
      failures: next.failures,
      lockedUntil: next.lockedUntil ? new Date(next.lockedUntil) : null,
      lastFailureAt: new Date(now),
      auditsWritten: next.auditsWritten,
      updatedAt: nowDate,
    })
    .where(and(eq(authThrottle.scope, scope), eq(authThrottle.subjectHash, subjectHash)));
  return { state: next, audit, alreadyLocked: false };
}

/** One locked update. Concurrent callers cannot overwrite each other's counts. */
export async function recordLoginFailure(
  db: Database,
  input: { scope: "admin_login_account" | "admin_login_ip"; subjectHash: string; now: number },
): Promise<FailureRecord> {
  return db.transaction(async (tx) => writeFailure(tx, input.scope, input.subjectHash, input.now));
}

/** Account row is locked before the IP row so two logins cannot deadlock. */
export async function recordLoginFailures(
  db: Database,
  input: { accountHash: string; ipHash: string | null; now: number },
  after?: (tx: Query, result: { account: FailureRecord; ip: FailureRecord | null }) => Promise<void>,
): Promise<{ account: FailureRecord; ip: FailureRecord | null }> {
  return db.transaction(async (tx) => {
    const account = await writeFailure(tx, "admin_login_account", input.accountHash, input.now);
    const ip = input.ipHash ? await writeFailure(tx, "admin_login_ip", input.ipHash, input.now) : null;
    const result = { account, ip };
    if (after) await after(tx, result);
    return result;
  });
}

export async function applySuccessThrottle(
  tx: Query,
  input: { accountHash: string; ipHash: string | null; now: number },
): Promise<void> {
  await tx
    .delete(authThrottle)
    .where(and(eq(authThrottle.scope, "admin_login_account"), eq(authThrottle.subjectHash, input.accountHash)));
  if (!input.ipHash) return;
  const [row] = await tx
    .select()
    .from(authThrottle)
    .where(and(eq(authThrottle.scope, "admin_login_ip"), eq(authThrottle.subjectHash, input.ipHash)))
    .for("update");
  if (!row) return;
  if (!canDeleteThrottleRow(toState(row), input.now, "ip")) return;
  await tx
    .delete(authThrottle)
    .where(and(eq(authThrottle.scope, "admin_login_ip"), eq(authThrottle.subjectHash, input.ipHash)));
}

/**
 * Success deletes the account bucket always.
 * The IP bucket is deleted only when its window or lock has already expired.
 */
export async function settleThrottleAfterSuccess(
  db: Database,
  input: { accountHash: string; ipHash: string | null; now: number },
): Promise<void> {
  await db.transaction(async (tx) => applySuccessThrottle(tx, input));
}

export { auditPlan, isLocked, nextAfterFailure };
