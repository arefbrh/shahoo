import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin, requireCustomer } from "../auth/guard.ts";
import { openDb } from "../auth/db.ts";
import { writeAudit } from "../auth/audit.ts";
import type { AppDatabase } from "../db/client.ts";
import { paymentAttempts, orders } from "../db/schema.ts";
import { captureVerifiedPayment, type PaymentProvider } from "./service.ts";
import { createPayPingIntent, payPingAttemptBelongsToCustomer, payPingConfigured, verifyPayPingPayment } from "./payping.ts";

const MAX_CALLBACK_BYTES = 32 * 1024;
const SETTLEMENT_LEASE_MS = 5 * 60 * 1000;
const callbackSchema = z.object({
  status: z.coerce.number().int().optional(),
  errorCode: z.string().trim().max(100).optional(),
  clientRefId: z.string().trim().min(1).max(100).optional(),
  paymentCode: z.string().trim().min(1).max(100).optional(),
  paymentRefId: z.coerce.number().int().positive().optional(),
  amount: z.coerce.number().int().positive().optional(),
  data: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
});

const localSettlementProvider: PaymentProvider = {
  key: "payping",
  configured: () => true,
  async createIntent(input) { return { authority: input.idempotencyKey }; },
  async verify(input) { return { ok: true, referenceId: input.token }; },
};

function payPingConfig(): { apiKey: string; returnUrl: string } {
  return { apiKey: process.env.PAYPING_API_KEY?.trim() ?? "", returnUrl: process.env.PAYPING_RETURN_URL?.trim() ?? "" };
}

export async function initiatePayPingPayment(orderId: string, idempotencyKey: string) {
  const { db, customer } = await requireCustomer();
  if (!payPingConfigured(process.env)) throw new Error("payping_disabled");
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, customer.id))).limit(1);
  if (!order) throw new Error("order_not_found");
  if (order.status !== "awaiting_payment" || order.paymentStatus !== "unpaid" || order.stockState !== "held") throw new Error("order_not_payable");
  if (!z.string().uuid().safeParse(idempotencyKey).success) throw new Error("payment_key_invalid");

  const [existing] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.idempotencyKey, idempotencyKey)).limit(1);
  if (existing) {
    if (existing.orderId !== order.id || existing.amountIrr !== order.totalIrr || existing.provider !== "payping") throw new Error("payment_key_conflict");
    if (existing.state === "provider_outcome_unknown") throw new Error("payment_reconciliation_required");
    if (existing.state === "manual_review") throw new Error("payment_manual_review_required");
    if (existing.state === "initiated") throw new Error("payment_initiation_pending");
    if (existing.providerPaymentCode && ["redirect_pending", "provider_verified", "local_settlement_pending"].includes(existing.state)) {
      return { attemptId: existing.id, redirectUrl: `https://api.payping.ir/v3/pay/start/${existing.providerPaymentCode}` };
    }
    throw new Error("payment_attempt_not_retryable");
  }

  const [active] = await db.select({ id: paymentAttempts.id }).from(paymentAttempts)
    .where(and(eq(paymentAttempts.orderId, order.id), sql`${paymentAttempts.state} IN ('initiated', 'redirect_pending', 'provider_outcome_unknown', 'provider_verified', 'local_settlement_pending', 'settling', 'manual_review')`)).limit(1);
  if (active) throw new Error("payment_attempt_active");

  const attemptId = `patt-${crypto.randomUUID()}`;
  const providerAmountToman = Math.trunc(order.totalIrr / 10);
  if (!Number.isSafeInteger(providerAmountToman) || providerAmountToman <= 0 || order.totalIrr % 10 !== 0) throw new Error("payment_amount_invalid");
  try {
    await db.insert(paymentAttempts).values({
      id: attemptId, orderId: order.id, provider: "payping", amountIrr: order.totalIrr,
      providerAmountToman, currency: "IRR", idempotencyKey, state: "initiated", expiresAt: order.stockHoldUntil,
    });
  } catch {
    throw new Error("payment_attempt_active");
  }

  try {
    const intent = await createPayPingIntent(payPingConfig(), { amountIrr: order.totalIrr, clientRefId: idempotencyKey, description: order.publicCode });
    await db.update(paymentAttempts).set({ providerPaymentCode: intent.paymentCode, providerRequestRef: idempotencyKey, state: "redirect_pending", updatedAt: new Date() }).where(and(eq(paymentAttempts.id, attemptId), eq(paymentAttempts.state, "initiated")));
    return { attemptId, redirectUrl: intent.url };
  } catch (error) {
    await db.update(paymentAttempts).set({ state: "provider_outcome_unknown", settlementError: "payping_intent_outcome_unknown", updatedAt: new Date() }).where(eq(paymentAttempts.id, attemptId));
    throw error;
  }
}

async function claimSettlement(db: AppDatabase, attemptId: string) {
  await db.update(paymentAttempts).set({ state: "local_settlement_pending", reconciliationRequired: true, settlementError: "settlement_lease_expired", updatedAt: new Date() })
    .where(and(eq(paymentAttempts.id, attemptId), eq(paymentAttempts.state, "settling"), lt(paymentAttempts.updatedAt, new Date(Date.now() - SETTLEMENT_LEASE_MS))));
  const [claimed] = await db.update(paymentAttempts).set({ state: "settling", updatedAt: new Date() })
    .where(and(eq(paymentAttempts.id, attemptId), sql`${paymentAttempts.state} IN ('provider_verified', 'local_settlement_pending')`))
    .returning();
  if (claimed) return claimed;
  const [current] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).limit(1);
  if (current?.state === "settled") return current;
  if (current?.state === "settling") throw new Error("payment_settlement_in_progress");
  throw new Error("payment_not_verified");
}

async function settleAttempt(db: AppDatabase, attemptId: string) {
  const attempt = await claimSettlement(db, attemptId);
  if (attempt.state === "settled") return { ok: true, already: true } as const;
  if (!attempt.providerReferenceId || attempt.verifiedAmountIrr !== attempt.amountIrr || attempt.provider !== "payping") {
    await db.update(paymentAttempts).set({ state: "local_settlement_pending", reconciliationRequired: true, settlementError: "verified_evidence_invalid", updatedAt: new Date() }).where(eq(paymentAttempts.id, attemptId));
    throw new Error("payment_reconciliation_required");
  }
  try {
    const result = await captureVerifiedPayment(db, { orderId: attempt.orderId, idempotencyKey: attempt.idempotencyKey, token: attempt.providerReferenceId, provider: localSettlementProvider, amountIrr: attempt.amountIrr });
    if (!result.ok) throw new Error("local_settlement_rejected");
    await db.update(paymentAttempts).set({ state: "settled", reconciliationRequired: false, settlementError: null, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
    return result;
  } catch (error) {
    await db.update(paymentAttempts).set({ state: "local_settlement_pending", reconciliationRequired: true, settlementError: error instanceof Error ? error.message.slice(0, 240) : "local_settlement_failed", updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
    throw new Error("payment_reconciliation_required");
  }
}

async function parseCallback(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_CALLBACK_BYTES) return null;
  const contentType = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded" && contentType !== "application/json") return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_CALLBACK_BYTES) {
        await reader.cancel("callback_body_too_large");
        return null;
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(body);
  if (contentType === "application/x-www-form-urlencoded") return Object.fromEntries(new URLSearchParams(text).entries());
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function recordUnverifiedCallbackFailure(
  db: AppDatabase,
  attemptId: string,
  errorCode: string,
) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(paymentAttempts)
      .set({
        state: "provider_outcome_unknown",
        reconciliationRequired: true,
        settlementError: `payping_callback_failure_unverified:${errorCode}`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(paymentAttempts.id, attemptId),
        sql`${paymentAttempts.state} IN ('initiated', 'redirect_pending', 'provider_outcome_unknown', 'manual_review')`,
      ))
      .returning();

    if (updated) {
      await writeAudit(tx, {
        actorType: "anonymous",
        action: "payment.callback_failure_unverified",
        entityType: "payment_attempt",
        entityId: attemptId,
        metadata: {
          errorCode,
          state: "provider_outcome_unknown",
          reconciliationRequired: true,
        },
      });
      return updated;
    }

    const [current] = await tx
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, attemptId))
      .limit(1);
    return current;
  });
}

export async function handlePayPingCallback(request: Request) {
  if (request.method !== "POST") return Response.json({ ok: false }, { status: 405, headers: { allow: "POST" } });
  let input = await parseCallback(request);
  if (!input) return Response.json({ ok: false, message: "callback_rejected" }, { status: 415 });
  if (typeof input.data === "string") {
    try {
      const nested = JSON.parse(input.data);
      if (!nested || typeof nested !== "object" || Array.isArray(nested)) return Response.json({ ok: false }, { status: 400 });
      input = { ...input, ...(nested as Record<string, unknown>) };
    } catch { return Response.json({ ok: false }, { status: 400 }); }
  } else if (input.data && typeof input.data === "object" && !Array.isArray(input.data)) {
    input = { ...input, ...(input.data as Record<string, unknown>) };
  }
  const parsed = callbackSchema.safeParse(input);
  if (!parsed.success || parsed.data.status === undefined || !parsed.data.clientRefId || !parsed.data.paymentCode) {
    return Response.json({ ok: false, message: "callback_rejected" }, { status: 400 });
  }
  const db = await openDb();
  const [attempt] = await db.select().from(paymentAttempts).where(and(eq(paymentAttempts.idempotencyKey, parsed.data.clientRefId), eq(paymentAttempts.providerPaymentCode, parsed.data.paymentCode))).limit(1);
  if (!attempt || attempt.provider !== "payping" || attempt.amountIrr % 10 !== 0 || (parsed.data.amount !== undefined && attempt.providerAmountToman !== parsed.data.amount)) return Response.json({ ok: false, message: "callback_mismatch" }, { status: 400 });
  if (attempt.state === "settled") return Response.json({ ok: true, already: true });
  if (parsed.data.status === 0) {
    if (!parsed.data.errorCode) return Response.json({ ok: false, message: "callback_rejected" }, { status: 400 });
    await recordUnverifiedCallbackFailure(db, attempt.id, parsed.data.errorCode);
    return Response.json({
      ok: false,
      pending: true,
      callbackFailureReported: true,
      reconciliationRequired: true,
    }, { status: 202 });
  }
  if (parsed.data.status !== 1 || !parsed.data.paymentRefId || parsed.data.amount === undefined) {
    return Response.json({ ok: false, message: "callback_rejected" }, { status: 400 });
  }
  if (attempt.state === "provider_outcome_unknown" && !attempt.providerPaymentCode) return Response.json({ ok: false, reconciliationRequired: true }, { status: 202 });
  let verified: Awaited<ReturnType<typeof verifyPayPingPayment>>;
  try {
    verified = await verifyPayPingPayment(payPingConfig(), { amountIrr: attempt.amountIrr, paymentCode: parsed.data.paymentCode, paymentRefId: parsed.data.paymentRefId });
    if (verified.clientRefId !== attempt.idempotencyKey || verified.code !== attempt.providerPaymentCode || verified.amount !== attempt.providerAmountToman) {
      throw new Error("payping_verify_unknown");
    }
  } catch (error) {
    if (error instanceof Error && ["payment_reconciliation_required", "payment_settlement_in_progress"].includes(error.message)) {
      return Response.json({ ok: false, reconciliationRequired: true }, { status: 202 });
    }
    // Any non-explicit rejection (including 202, 408, 429, 5xx, network and
    // unexpected internal errors) must remain recoverable, never be marked failed.
    await db.update(paymentAttempts).set({
      state: "provider_outcome_unknown",
      verificationPaymentRefId: parsed.data.paymentRefId,
      reconciliationRequired: true,
      settlementError: "payping_verification_outcome_unknown",
      updatedAt: new Date(),
    }).where(and(eq(paymentAttempts.id, attempt.id), sql`${paymentAttempts.state} IN ('redirect_pending', 'provider_outcome_unknown', 'manual_review')`));
    return Response.json({ ok: false, pending: true, reconciliationRequired: true }, { status: 202 });
  }

  await db.update(paymentAttempts).set({
    state: "provider_verified",
    verificationPaymentRefId: verified.paymentRefId,
    providerReferenceId: String(verified.paymentRefId),
    verifiedAmountIrr: attempt.amountIrr,
    verifiedAt: new Date(),
    reconciliationRequired: false,
    settlementError: null,
    updatedAt: new Date(),
  }).where(and(eq(paymentAttempts.id, attempt.id), sql`${paymentAttempts.state} IN ('redirect_pending', 'provider_outcome_unknown', 'provider_verified', 'manual_review')`));
  try {
    await settleAttempt(db, attempt.id);
    return Response.json({ ok: true });
  } catch {
    // Verification is already persisted. A local settlement failure cannot
    // be misclassified as a provider rejection.
    return Response.json({ ok: false, reconciliationRequired: true }, { status: 202 });
  }
}

export async function retryPayPingSettlement(attemptId: string) {
  const { db, customer } = await requireCustomer();
  const [row] = await db.select({ attempt: paymentAttempts, orderId: orders.id, orderCustomerId: orders.customerId }).from(paymentAttempts)
    .innerJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(and(eq(paymentAttempts.id, attemptId), eq(orders.customerId, customer.id))).limit(1);
  if (!row || !payPingAttemptBelongsToCustomer(row.attempt.orderId, row.orderId, row.orderCustomerId, customer.id)) throw new Error("payment_attempt_not_found");
  const attempt = row.attempt;
  if (attempt.provider !== "payping" || !attempt.providerReferenceId || attempt.verifiedAmountIrr !== attempt.amountIrr || !attempt.verifiedAt || !["provider_verified", "local_settlement_pending"].includes(attempt.state)) throw new Error("payment_not_retryable");
  return settleAttempt(db, attempt.id);
}

export async function retryPayPingVerificationAttempt(
  db: AppDatabase,
  attempt: typeof paymentAttempts.$inferSelect,
) {
  if (attempt.provider !== "payping" || !["provider_outcome_unknown", "manual_review"].includes(attempt.state) || !attempt.providerPaymentCode || !attempt.verificationPaymentRefId) {
    throw new Error("payment_verification_not_retryable");
  }

  let verified: Awaited<ReturnType<typeof verifyPayPingPayment>>;
  try {
    verified = await verifyPayPingPayment(payPingConfig(), {
      amountIrr: attempt.amountIrr,
      paymentCode: attempt.providerPaymentCode,
      paymentRefId: attempt.verificationPaymentRefId,
    });
    if (verified.clientRefId !== attempt.idempotencyKey || verified.code !== attempt.providerPaymentCode || verified.amount !== attempt.providerAmountToman) {
      throw new Error("payping_verify_unknown");
    }
  } catch {
    // Do not infer provider rejection from an HTTP error, malformed response,
    // identifier mismatch, or unexpected runtime exception. Preserve the
    // original attempt for safe reconciliation/retry.
    await db.update(paymentAttempts).set({
      state: "provider_outcome_unknown",
      reconciliationRequired: true,
      settlementError: "payping_verification_outcome_unknown",
      updatedAt: new Date(),
    }).where(and(eq(paymentAttempts.id, attempt.id), sql`${paymentAttempts.state} IN ('provider_outcome_unknown', 'manual_review')`));
    throw new Error("payment_verification_outcome_unknown");
  }

  await db.update(paymentAttempts).set({
    state: "provider_verified",
    providerReferenceId: String(verified.paymentRefId),
    verificationPaymentRefId: verified.paymentRefId,
    verifiedAmountIrr: attempt.amountIrr,
    verifiedAt: new Date(),
    reconciliationRequired: false,
    settlementError: null,
    updatedAt: new Date(),
  }).where(and(eq(paymentAttempts.id, attempt.id), sql`${paymentAttempts.state} IN ('provider_outcome_unknown', 'manual_review')`));

  // Settlement is intentionally outside the verification catch. A local
  // settlement error cannot be misclassified as a provider rejection.
  return settleAttempt(db, attempt.id);
}

export async function retryPayPingVerification(attemptId: string) {
  const { db, customer } = await requireCustomer();
  const [row] = await db.select({ attempt: paymentAttempts, orderId: orders.id, orderCustomerId: orders.customerId }).from(paymentAttempts)
    .innerJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(and(eq(paymentAttempts.id, attemptId), eq(orders.customerId, customer.id))).limit(1);
  if (!row || !payPingAttemptBelongsToCustomer(row.attempt.orderId, row.orderId, row.orderCustomerId, customer.id)) throw new Error("payment_attempt_not_found");
  return retryPayPingVerificationAttempt(db, row.attempt);
}

export async function retryPayPingVerificationForAdmin(attemptId: string) {
  const { db } = await requireAdmin("orders.write");
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).limit(1);
  if (!attempt) throw new Error("payment_attempt_not_found");
  return retryPayPingVerificationAttempt(db, attempt);
}

export async function retryPayPingSettlementForAdmin(attemptId: string) {
  const { db } = await requireAdmin("orders.write");
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).limit(1);
  if (!attempt || attempt.provider !== "payping" || !attempt.providerReferenceId || attempt.verifiedAmountIrr !== attempt.amountIrr || !attempt.verifiedAt || !["provider_verified", "local_settlement_pending"].includes(attempt.state)) {
    throw new Error("payment_not_retryable");
  }
  return settleAttempt(db, attempt.id);
}

export async function reviewPayPingUnknownAttempt(attemptId: string, decision: "manual_review", note: string) {
  const { db, admin } = await requireAdmin("orders.write");
  const cleanNote = note.trim().slice(0, 500);
  if (cleanNote.length < 10) throw new Error("payment_review_note_required");
  await db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(paymentAttempts).where(and(eq(paymentAttempts.id, attemptId), eq(paymentAttempts.state, "provider_outcome_unknown"))).for("update").limit(1);
    if (!attempt) throw new Error("payment_attempt_not_reviewable");
    await tx.update(paymentAttempts).set({ state: decision, reconciliationRequired: decision === "manual_review", settlementError: cleanNote, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
    await writeAudit(tx, { actorType: "admin", actorId: admin.id, action: "payment.manual_review", entityType: "payment_attempt", entityId: attempt.id, metadata: { decision, note: cleanNote, orderId: attempt.orderId } });
  });
  return { ok: true, decision } as const;
}
