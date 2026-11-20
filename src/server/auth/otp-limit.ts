import { and, eq } from "drizzle-orm";
import { nextOtpBucket, type OtpBucket, type OtpBucketDecision } from "@/lib/otp-bucket";
import type { AppDatabase } from "../db/client";
import { otpRequestBuckets } from "../db/schema";
import { OTP_MAX_IN_WINDOW, OTP_RESEND_MS, OTP_WINDOW_MS } from "./policy";

export const OTP_IP_WINDOW_MS = 30 * 60 * 1000;
export const OTP_IP_MAX = 20;

type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

function asBucket(row: { hits: number; windowStartedAt: Date | string; lastRequestAt: Date | string | null }): OtpBucket {
  return {
    hits: Number(row.hits),
    windowStartedAt: new Date(row.windowStartedAt).getTime(),
    lastRequestAt: row.lastRequestAt ? new Date(row.lastRequestAt).getTime() : null,
  };
}

async function lockBucket(tx: Tx, scope: string, subjectHash: string, now: number) {
  await tx
    .insert(otpRequestBuckets)
    .values({ scope, subjectHash, windowStartedAt: new Date(now), hits: 0, lastRequestAt: null })
    .onConflictDoNothing({ target: [otpRequestBuckets.scope, otpRequestBuckets.subjectHash] });
  const [row] = await tx
    .select()
    .from(otpRequestBuckets)
    .where(and(eq(otpRequestBuckets.scope, scope), eq(otpRequestBuckets.subjectHash, subjectHash)))
    .for("update");
  if (!row) throw new Error("otp bucket missing");
  return row;
}

async function saveBucket(tx: Tx, scope: string, subjectHash: string, next: OtpBucket) {
  await tx
    .update(otpRequestBuckets)
    .set({
      hits: next.hits,
      windowStartedAt: new Date(next.windowStartedAt),
      lastRequestAt: new Date(next.lastRequestAt ?? next.windowStartedAt),
    })
    .where(and(eq(otpRequestBuckets.scope, scope), eq(otpRequestBuckets.subjectHash, subjectHash)));
}

/** Mobile is locked before IP. A refused request writes neither counter. */
export async function reserveOtpSend(
  db: AppDatabase,
  input: { mobileHash: string; ipHash: string | null; now: number },
): Promise<OtpBucketDecision & { scope?: "mobile" | "ip" }> {
  return db.transaction(async (tx) => {
    const mobileRow = await lockBucket(tx, "otp_mobile", input.mobileHash, input.now);
    const mobile = nextOtpBucket(input.now, asBucket(mobileRow), {
      windowMs: OTP_WINDOW_MS,
      max: OTP_MAX_IN_WINDOW,
      cooldownMs: OTP_RESEND_MS,
    });
    if (!mobile.ok) return { ...mobile, scope: "mobile" };
    let ip: OtpBucketDecision | null = null;
    if (input.ipHash) {
      const ipRow = await lockBucket(tx, "otp_ip", input.ipHash, input.now);
      ip = nextOtpBucket(input.now, asBucket(ipRow), { windowMs: OTP_IP_WINDOW_MS, max: OTP_IP_MAX, cooldownMs: 0 });
      if (!ip.ok) return { ...ip, scope: "ip" };
    }
    await saveBucket(tx, "otp_mobile", input.mobileHash, mobile.next);
    if (input.ipHash && ip?.ok) await saveBucket(tx, "otp_ip", input.ipHash, ip.next);
    return { ok: true, next: mobile.next, scope: "mobile" };
  });
}


export const OTP_VERIFY_WINDOW_MS = 30 * 60 * 1000;
export const OTP_VERIFY_MOBILE_MAX = 12;
export const OTP_VERIFY_IP_MAX = 60;

/** Counts verification attempts across challenge re-issues, not just per OTP row. */
export async function reserveOtpVerifyAttempt(db: AppDatabase, input: { mobileHash: string; ipHash: string | null; now: number }) {
  return db.transaction(async (tx) => {
    const mobileRow = await lockBucket(tx, "otp_verify_mobile", input.mobileHash, input.now);
    const mobile = nextOtpBucket(input.now, asBucket(mobileRow), { windowMs: OTP_VERIFY_WINDOW_MS, max: OTP_VERIFY_MOBILE_MAX, cooldownMs: 0 });
    if (!mobile.ok) return { ...mobile, scope: "mobile" as const };
    let ip: OtpBucketDecision | null = null;
    if (input.ipHash) {
      const ipRow = await lockBucket(tx, "otp_verify_ip", input.ipHash, input.now);
      ip = nextOtpBucket(input.now, asBucket(ipRow), { windowMs: OTP_VERIFY_WINDOW_MS, max: OTP_VERIFY_IP_MAX, cooldownMs: 0 });
      if (!ip.ok) return { ...ip, scope: "ip" as const };
    }
    await saveBucket(tx, "otp_verify_mobile", input.mobileHash, mobile.next);
    if (input.ipHash && ip?.ok) await saveBucket(tx, "otp_verify_ip", input.ipHash, ip.next);
    return { ok: true as const };
  });
}
