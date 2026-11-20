import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { ACCOUNT_LOCK_AFTER, ACCOUNT_WINDOW_MS, IP_LOCK_AFTER } from "../../lib/login-throttle.ts";
import * as schema from "../db/schema.ts";
import { authThrottle } from "../db/schema.ts";
import { cleanupExpiredThrottle, readThrottle, recordLoginFailure, settleThrottleAfterSuccess } from "./throttle.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function database() {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(readFileSync(join(root, "migrations/0004_batch_0501.sql"), "utf8").split("alter table orders")[0]);
  return drizzle(pg, { schema });
}

test("concurrent account failures lock at five and do not lose counts", async () => {
  const db = await database();
  const now = 1_700_000_000_000;
  await Promise.all(
    Array.from({ length: 8 }, () =>
      recordLoginFailure(db, { scope: "admin_login_account", subjectHash: "acct", now }),
    ),
  );
  const state = await readThrottle(db, "admin_login_account", "acct");
  assert.equal(state.failures, ACCOUNT_LOCK_AFTER);
  assert.equal(state.auditsWritten, 4);
  assert.ok(state.lockedUntil && state.lockedUntil > now);
});

test("concurrent ip failures lock at twenty", async () => {
  const db = await database();
  const now = 1_700_000_000_000;
  await Promise.all(
    Array.from({ length: 25 }, () => recordLoginFailure(db, { scope: "admin_login_ip", subjectHash: "ip", now })),
  );
  const state = await readThrottle(db, "admin_login_ip", "ip");
  assert.equal(state.failures, IP_LOCK_AFTER);
  assert.ok(state.lockedUntil && state.lockedUntil > now);
});

test("a failure outside the stored window resets before counting", async () => {
  const db = await database();
  const start = 1_700_000_000_000;
  await recordLoginFailure(db, { scope: "admin_login_account", subjectHash: "late", now: start });
  await recordLoginFailure(db, { scope: "admin_login_account", subjectHash: "late", now: start + 1000 });
  const again = await recordLoginFailure(db, {
    scope: "admin_login_account",
    subjectHash: "late",
    now: start + ACCOUNT_WINDOW_MS + 1000,
  });
  assert.equal(again.state.failures, 1);
  assert.equal(again.alreadyLocked, false);
});

test("successful login clears the account bucket and keeps a live ip bucket", async () => {
  const db = await database();
  const now = 1_700_000_000_000;
  await recordLoginFailure(db, { scope: "admin_login_account", subjectHash: "acct-ok", now });
  await recordLoginFailure(db, { scope: "admin_login_ip", subjectHash: "ip-ok", now });
  await settleThrottleAfterSuccess(db, { accountHash: "acct-ok", ipHash: "ip-ok", now: now + 1000 });
  const account = await readThrottle(db, "admin_login_account", "acct-ok");
  const ip = await readThrottle(db, "admin_login_ip", "ip-ok");
  assert.equal(account.failures, 0);
  assert.equal(ip.failures, 1);
});

test("cleanup deletes expired rows and keeps locks and open windows", async () => {
  const db = await database();
  const now = 1_700_000_000_000;
  await db.insert(authThrottle).values([
    {
      scope: "admin_login_account",
      subjectHash: "open",
      failures: 2,
      lastFailureAt: new Date(now - 60_000),
      auditsWritten: 2,
      updatedAt: new Date(now),
    },
    {
      scope: "admin_login_account",
      subjectHash: "stale",
      failures: 4,
      lastFailureAt: new Date(now - ACCOUNT_WINDOW_MS - 1000),
      auditsWritten: 3,
      updatedAt: new Date(now),
    },
    {
      scope: "admin_login_ip",
      subjectHash: "locked",
      failures: 20,
      lockedUntil: new Date(now + 60_000),
      lastFailureAt: new Date(now - 86_400_000),
      auditsWritten: 4,
      updatedAt: new Date(now),
    },
  ]);
  const removed = await cleanupExpiredThrottle(db, now);
  assert.equal(removed, 1);
  assert.equal((await readThrottle(db, "admin_login_account", "open")).failures, 2);
  assert.equal((await readThrottle(db, "admin_login_account", "stale")).failures, 0);
  assert.equal((await readThrottle(db, "admin_login_ip", "locked")).failures, 20);
});
