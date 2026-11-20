import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { before } from "node:test";
import { fileURLToPath } from "node:url";
import { requestHandler } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { getPglite } from "../../lib/db.ts";
import { getDb } from "../db/client.ts";
import { auditLogs, customerSessions, customers, otpChallenges } from "../db/schema.ts";
import { ensureSeed } from "../db/seed.ts";
import { requestCustomerOtp, verifyCustomerOtp } from "./customer.ts";
import { hashSecret } from "./crypto.ts";
import { reserveOtpVerifyAttempt } from "./otp-limit.ts";
import { LOGIN_PURPOSE, OTP_MAX_ATTEMPTS, OTP_RESEND_MS, OTP_TTL_MS } from "./policy.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
let db: Awaited<ReturnType<typeof getDb>>;
let pg: Awaited<ReturnType<typeof getPglite>>;

before(async () => {
  pg = await getPglite();
  for (const name of readdirSync(join(root, "migrations")).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  }
  db = await getDb();
  await ensureSeed();
});

async function redeem(mobile: string, code: string) {
  let result!: Awaited<ReturnType<typeof verifyCustomerOtp>>;
  const handler = requestHandler(async () => {
    result = await verifyCustomerOtp(mobile, code);
    return new Response("ok");
  });
  const response = await handler(new Request("https://shahoo.test/login"), {});
  return { result, cookie: response.headers.get("set-cookie") };
}

async function customer(id: string, mobile: string) {
  await db.insert(customers).values({ id, mobile, fullName: "OTP test", status: "active" });
}

async function challenge(id: string, mobile: string, code: string, createdAt: Date, attempts = 0) {
  await db.insert(otpChallenges).values({
    id,
    mobile,
    purpose: LOGIN_PURPOSE,
    codeHash: hashSecret(code),
    attempts,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + OTP_TTL_MS),
  });
}

// These tests force interleavings after the database has reserved attempts.
// PGlite uses one connection: this tests the application race, not real PostgreSQL concurrency.
function interceptAttempts(onReserved: () => Promise<void>) {
  const original = pg.query;
  pg.query = (async (text: string, params?: unknown[], options?: Parameters<typeof pg.query>[2]) => {
    const result = await original.call(pg, text, params, options);
    if (/^update "otp_challenges" set "attempts"/i.test(text) && result.rows.length > 0) await onReserved();
    return result;
  }) as typeof pg.query;
  return () => { pg.query = original; };
}

test("concurrent redemption of one OTP creates only one session", { timeout: 15_000 }, async () => {
  const mobile = "09120000111";
  await customer("otp-race-customer", mobile);
  await challenge("otp-race-old", mobile, "11111", new Date(Date.now() - OTP_RESEND_MS - 1_000));
  await challenge("otp-race-new", mobile, "12345", new Date());
  let reservations = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const restore = interceptAttempts(async () => {
    reservations += 1;
    if (reservations === 2) release();
    await gate;
  });
  let results: Awaited<ReturnType<typeof redeem>>[];
  try {
    results = await Promise.all([redeem(mobile, "12345"), redeem(mobile, "12345")]);
  } finally {
    restore();
    release();
  }
  assert.equal(reservations, 2, "both requests must reserve an attempt before either consumes");
  assert.equal(results.filter(({ result }) => result.ok).length, 1);
  assert.equal(results.filter(({ cookie }) => cookie?.includes("shahoo_customer=")).length, 1);
  assert.equal((await db.select().from(customerSessions).where(eq(customerSessions.customerId, "otp-race-customer"))).length, 1);
  assert.equal((await db.select().from(auditLogs).where(eq(auditLogs.action, "customer.login"))).filter((row) => row.actorId === "otp-race-customer").length, 1);
  const rows = await db.select().from(otpChallenges).where(eq(otpChallenges.mobile, mobile));
  assert.equal(rows.every((row) => row.consumedAt !== null), true, "success retains the existing bulk invalidation");
  const replay = await redeem(mobile, "12345");
  assert.equal(replay.result.ok, false);
  assert.equal(replay.cookie, null);
  assert.equal((await db.select().from(customerSessions).where(eq(customerSessions.customerId, "otp-race-customer"))).length, 1);
});

test("a different consumed row is not evidence that the checked OTP was consumed", async () => {
  const mobile = "09120000112";
  await customer("otp-stale-customer", mobile);
  await challenge("otp-stale-old", mobile, "11111", new Date(Date.now() - OTP_RESEND_MS - 1_000));
  await challenge("otp-stale-new", mobile, "12345", new Date());
  let reservations = 0;
  const restore = interceptAttempts(async () => {
    reservations += 1;
    await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, "otp-stale-new"));
  });
  let result: Awaited<ReturnType<typeof redeem>>;
  try {
    result = await redeem(mobile, "12345");
  } finally {
    restore();
  }
  assert.equal(reservations, 1);
  assert.equal(result.result.ok, false);
  assert.equal(result.cookie, null);
  assert.equal((await db.select().from(customerSessions).where(eq(customerSessions.customerId, "otp-stale-customer"))).length, 0);
});

test("issuing a new OTP atomically invalidates the previous challenge", async () => {
  const mobile = "09120000115";
  await customer("otp-latest-customer", mobile);
  await challenge("otp-latest-old", mobile, "11111", new Date(Date.now() - OTP_RESEND_MS - 1_000));
  const previous = { NODE_ENV: process.env.NODE_ENV, ECHO_OTP: process.env.ECHO_OTP, SMS_MODE: process.env.SMS_MODE };
  process.env.NODE_ENV = "development";
  process.env.ECHO_OTP = "1";
  process.env.SMS_MODE = "disabled";
  try {
    const issued = await requestCustomerOtp(mobile);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    assert.match(issued.previewCode ?? "", /^\d{5}$/);
    assert.equal((await redeem(mobile, "11111")).result.ok, false);
    assert.equal((await redeem(mobile, issued.previewCode!)).result.ok, true);
  } finally {
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.ECHO_OTP === undefined) delete process.env.ECHO_OTP; else process.env.ECHO_OTP = previous.ECHO_OTP;
    if (previous.SMS_MODE === undefined) delete process.env.SMS_MODE; else process.env.SMS_MODE = previous.SMS_MODE;
  }
});

test("the correct code still succeeds on the last permitted attempt", async () => {
  const mobile = "09120000114";
  await customer("otp-last-customer", mobile);
  await challenge("otp-last", mobile, "12345", new Date(), OTP_MAX_ATTEMPTS - 1);
  const result = await redeem(mobile, "12345");
  assert.equal(result.result.ok, true);
  const [row] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, "otp-last"));
  assert.equal(row.attempts, OTP_MAX_ATTEMPTS);
  assert.notEqual(row.consumedAt, null);
});

test("an older challenge cannot reappear after the newest challenge is exhausted", async () => {
  const mobile = "09120000113";
  await customer("otp-fallback-customer", mobile);
  await challenge("otp-fallback-old", mobile, "11111", new Date(Date.now() - OTP_RESEND_MS - 1_000));
  await challenge("otp-fallback-new", mobile, "12345", new Date(), OTP_MAX_ATTEMPTS - 1);
  const failed = await redeem(mobile, "99999");
  assert.equal(failed.result.ok, false);
  const older = await redeem(mobile, "11111");
  assert.equal(older.result.ok, false);
});


test("OTP verification throttle accumulates across separate challenge IDs", async () => {
  const mobileHash = "otp-verify-throttle-mobile-test";
  for (let i = 0; i < 12; i += 1) {
    const result = await reserveOtpVerifyAttempt(db, { mobileHash, ipHash: null, now: 1_800_000_000_000 + i });
    assert.equal(result.ok, true);
  }
  const blocked = await reserveOtpVerifyAttempt(db, { mobileHash, ipHash: null, now: 1_800_000_000_100 });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.retryAfterSec > 0);
});
