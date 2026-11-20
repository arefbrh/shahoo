import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { nextOtpBucket, type OtpBucket } from "@/lib/otp-bucket";
import type { AppDatabase } from "../db/client";
import { otpRequestBuckets } from "../db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const IP_MAX = 20;
const CART_MAX = 3;

type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
function hash(value: string): string { return createHash("sha256").update(`guest_checkout\n${value}`).digest("hex"); }
function toBucket(row: { hits: number; windowStartedAt: Date | string; lastRequestAt: Date | string | null }): OtpBucket {
  return { hits: Number(row.hits), windowStartedAt: new Date(row.windowStartedAt).getTime(), lastRequestAt: row.lastRequestAt ? new Date(row.lastRequestAt).getTime() : null };
}
async function reserve(tx: Tx, scope: string, subject: string, now: number, max: number) {
  const subjectHash = hash(subject);
  await tx.insert(otpRequestBuckets).values({ scope, subjectHash, windowStartedAt: new Date(now), hits: 0, lastRequestAt: null }).onConflictDoNothing({ target: [otpRequestBuckets.scope, otpRequestBuckets.subjectHash] });
  const [row] = await tx.select().from(otpRequestBuckets).where(and(eq(otpRequestBuckets.scope, scope), eq(otpRequestBuckets.subjectHash, subjectHash))).for("update");
  if (!row) throw new Error("guest_checkout_bucket_missing");
  const decision = nextOtpBucket(now, toBucket(row), { windowMs: WINDOW_MS, max, cooldownMs: 0 });
  if (!decision.ok) return decision;
  await tx.update(otpRequestBuckets).set({ hits: decision.next.hits, windowStartedAt: new Date(decision.next.windowStartedAt), lastRequestAt: new Date(decision.next.lastRequestAt ?? now) }).where(and(eq(otpRequestBuckets.scope, scope), eq(otpRequestBuckets.subjectHash, subjectHash)));
  return decision;
}

/** Limit anonymous order creation by network and durable guest-cart identity. */
export async function reserveGuestCheckout(db: AppDatabase, input: { ip: string | null; cartKey: string; now?: number }) {
  const now = input.now ?? Date.now();
  return db.transaction(async (tx) => {
    const ipKey = input.ip ? `ip:${input.ip}` : `cart-fallback:${input.cartKey}`;
    const ipDecision = await reserve(tx, "guest_checkout_ip", ipKey, now, IP_MAX);
    if (!ipDecision.ok) return ipDecision;
    const cartDecision = await reserve(tx, "guest_checkout_cart", input.cartKey, now, CART_MAX);
    if (!cartDecision.ok) return cartDecision;
    return { ok: true as const };
  });
}
