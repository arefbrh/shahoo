import { and, eq, sql } from "drizzle-orm";
import { isLineSellable, paymentTransition } from "../../lib/commerce-integrity.ts";
import { writeAudit } from "../auth/audit.ts";
import type { AppDatabase } from "../db/client";
import {
  inventory,
  inventoryLogs,
  orderEvents,
  orderItems,
  orders,
  paymentLogs,
  payments,
  productCategories,
  productVariants,
  products,
} from "../db/schema";
import { isIdempotencyConflict } from "../db/sql-error.ts";
import { mockPaymentAllowed } from "../env/runtime.ts";
import { recordNotice } from "../notify/events";
import { createPayPingIntent, payPingConfigured, verifyPayPingPayment } from "./payping.ts";

export interface PaymentProvider {
  key: "mock" | "zarinpal" | "zibal" | "idpay" | "payping";
  configured(env?: NodeJS.ProcessEnv): boolean;
  createIntent(input: { orderId: string; amountIrr: number; idempotencyKey: string }): Promise<{ authority: string | null }>;
  verify(input: { authority: string; amountIrr: number; token: string }): Promise<{ ok: true; referenceId: string } | { ok: false; reason: string }>;
}

export class GatewayNotConnected extends Error {
  constructor() {
    super("gateway_not_connected");
    this.name = "GatewayNotConnected";
  }
}

function namedGateway(key: "zarinpal" | "zibal" | "idpay", envName: string): PaymentProvider {
  return {
    key,
    configured(env = process.env) {
      return Boolean(env[envName]?.trim());
    },
    async createIntent() {
      throw new GatewayNotConnected();
    },
    async verify() {
      throw new GatewayNotConnected();
    },
  };
}

export const zarinpalProvider = namedGateway("zarinpal", "ZARINPAL_MERCHANT_ID");
export const zibalProvider = namedGateway("zibal", "ZIBAL_MERCHANT");
export const idpayProvider = namedGateway("idpay", "IDPAY_API_KEY");

export const payPingProvider: PaymentProvider = {
  key: "payping",
  configured(env = process.env) {
    return payPingConfigured(env);
  },
  async createIntent(input) {
    const intent = await createPayPingIntent(
      { apiKey: process.env.PAYPING_API_KEY?.trim() ?? "", returnUrl: process.env.PAYPING_RETURN_URL?.trim() ?? "" },
      { amountIrr: input.amountIrr, clientRefId: input.idempotencyKey, description: input.orderId },
    );
    return { authority: intent.paymentCode };
  },
  async verify(input) {
    try {
      const verified = await verifyPayPingPayment(
        { apiKey: process.env.PAYPING_API_KEY?.trim() ?? "" },
        { amountIrr: input.amountIrr, paymentCode: input.authority, paymentRefId: Number(input.token) },
      );
      return { ok: true, referenceId: String(verified.paymentRefId) };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "payping_verify_failed" };
    }
  },
};

export const PAYMENT_CURRENCY = "IRR";

export function samePaymentReplay(
  existing: { orderId: string; amountIrr: number; currency?: string },
  requested: { orderId: string; amountIrr: number; currency?: string },
): boolean {
  const currencyOf = (row: { currency?: string }) => row.currency ?? PAYMENT_CURRENCY;
  return existing.orderId === requested.orderId && existing.amountIrr === requested.amountIrr && currencyOf(existing) === currencyOf(requested);
}

export function mockProvider(): PaymentProvider {
  return {
    key: "mock",
    configured(env = process.env) {
      return mockPaymentAllowed(env);
    },
    async createIntent(input) {
      if (!mockPaymentAllowed(process.env)) return { authority: null };
      return { authority: `mock-${input.idempotencyKey}` };
    },
    async verify(input) {
      if (!mockPaymentAllowed(process.env)) return { ok: false, reason: "mock_rejected" };
      if (input.token !== `mock-ok:${input.authority}`) return { ok: false, reason: "mock_rejected" };
      return { ok: true, referenceId: `mock-ref-${input.authority}` };
    },
  };
}

export function resolvePaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider | null {
  const key = env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (key === "mock") {
    if (!mockPaymentAllowed(env)) return null;
    return mockProvider();
  }
  if (key === "zarinpal") return zarinpalProvider;
  if (key === "zibal") return zibalProvider;
  if (key === "idpay") return idpayProvider;
  if (key === "payping") return payPingProvider;
  return null;
}

type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type CaptureResult = { ok: true; already: boolean } | { ok: false; message: string };

class PaymentHalt extends Error {
  readonly result: CaptureResult;

  constructor(result: CaptureResult) {
    super("payment_halt");
    this.name = "PaymentHalt";
    this.result = result;
  }
}

/**
 * Marks an order paid only after the provider verifies the token.
 * Stock moves once. A repeated idempotency key returns the original result.
 * A failed key cannot later become a success. Storefront checkout does not call this.
 */
export async function captureVerifiedPayment(
  db: AppDatabase,
  input: {
    orderId: string;
    idempotencyKey: string;
    token: string;
    provider: PaymentProvider;
    currency?: string;
    amountIrr?: number;
  },
): Promise<CaptureResult> {
  if (!input.provider.configured()) return { ok: false, message: "درگاه پرداخت وصل نیست." };
  if (input.currency && input.currency !== PAYMENT_CURRENCY) return { ok: false, message: "واحد پول باید ریال باشد." };
  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) return { ok: false, message: "سفارش پیدا نشد." };
  if (input.amountIrr !== undefined && input.amountIrr !== order.totalIrr) {
    return { ok: false, message: "مبلغ پرداخت با سفارش یکی نیست." };
  }
  const requested = { orderId: order.id, amountIrr: order.totalIrr, currency: PAYMENT_CURRENCY };
  const [existing] = await db.select().from(payments).where(eq(payments.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing) {
    if (!samePaymentReplay(existing, requested)) return { ok: false, message: "این کلید پرداخت برای سفارش یا مبلغ دیگری است." };
    if (existing.status === "verified") return { ok: true, already: true };
    if (existing.status === "failed" || existing.status === "expired") {
      return { ok: false, message: "این پرداخت قبلاً ناموفق بسته شده است." };
    }
  }
  if (order.paymentStatus === "verified" || order.stockState === "captured") {
    return { ok: false, message: "این سفارش قبلاً پرداخت شده است." };
  }
  const payable = order.status === "awaiting_payment" && order.paymentStatus === "unpaid" && order.stockState === "held";
  const recoverable = order.status === "expired" && order.paymentStatus === "unpaid" && order.stockState === "released";
  if (!payable && !recoverable) return { ok: false, message: "این سفارش برای تأیید پرداخت آماده نیست." };

  try {
    const intent = await input.provider.createIntent({
      orderId: order.id,
      amountIrr: order.totalIrr,
      idempotencyKey: input.idempotencyKey,
    });
    const authority = intent.authority ?? "";
    const verified = await input.provider.verify({ authority, amountIrr: order.totalIrr, token: input.token });
    if (!verified.ok) {
      await recordTerminalPayment(db, order, input.provider.key, input.idempotencyKey, authority, "failed");
      return { ok: false, message: "تأیید پرداخت پذیرفته نشد." };
    }
    await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update").limit(1);
      if (!locked) throw new PaymentHalt({ ok: false, message: "سفارش پیدا نشد." });
      if (locked.paymentStatus === "verified" || locked.stockState === "captured") {
        throw new PaymentHalt({ ok: false, message: "این سفارش قبلاً پرداخت شده است." });
      }
      const stillPayable = locked.status === "awaiting_payment" && locked.paymentStatus === "unpaid" && locked.stockState === "held";
      const stillRecoverable = locked.status === "expired" && locked.paymentStatus === "unpaid" && locked.stockState === "released";
      if (!stillPayable && !stillRecoverable) {
        throw new PaymentHalt({ ok: false, message: "این سفارش برای تأیید پرداخت آماده نیست." });
      }
      if (stillPayable) await captureStock(tx, locked.id, locked.publicCode);
      else await recoverStock(tx, locked.id, locked.publicCode);
      const claimed = await tx
        .update(orders)
        .set({
          status: "paid",
          paymentStatus: "verified",
          stockState: "captured",
          stockHoldUntil: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.id, locked.id),
            eq(orders.status, stillPayable ? "awaiting_payment" : "expired"),
            eq(orders.paymentStatus, "unpaid"),
            eq(orders.stockState, stillPayable ? "held" : "released"),
          ),
        )
        .returning({ id: orders.id, publicCode: orders.publicCode, mobile: orders.mobile, customerId: orders.customerId });
      const row = claimed[0];
      if (!row) throw new PaymentHalt({ ok: false, message: "این سفارش برای تأیید پرداخت آماده نیست." });
      const paymentId = `pay-${crypto.randomUUID()}`;
      await tx.insert(payments).values({
        id: paymentId,
        orderId: row.id,
        provider: input.provider.key,
        status: "verified",
        amountIrr: locked.totalIrr,
        currency: PAYMENT_CURRENCY,
        authority,
        referenceId: verified.referenceId,
        idempotencyKey: input.idempotencyKey,
      });
      await tx.insert(paymentLogs).values({
        id: `plog-${crypto.randomUUID()}`,
        paymentId,
        event: "verified",
        payload: { provider: input.provider.key, recovered: stillRecoverable },
      });
      await tx.insert(orderEvents).values({
        id: `oev-${crypto.randomUUID()}`,
        orderId: row.id,
        status: "paid",
        note: stillRecoverable
          ? "بعد از پایان مهلت، موجودی دوباره بررسی و پرداخت در سرویس داخلی تأیید شد. درگاه بیرونی فراخوانی نشده است."
          : "پرداخت در سرویس داخلی تأیید شد. درگاه بیرونی فراخوانی نشده است.",
        actor: "system",
      });
      await recordNotice(tx, {
        eventKey: "order.status",
        detail: `${row.publicCode} پرداخت تأیید شد`,
        recipient: row.mobile,
        customerId: row.customerId,
        orderId: row.id,
      });
      await writeAudit(tx, {
        actorType: "system",
        actorId: row.customerId,
        action: "payment.verified",
        entityType: "order",
        entityId: row.id,
        metadata: { provider: input.provider.key, amountIrr: locked.totalIrr, currency: PAYMENT_CURRENCY, recovered: stillRecoverable },
      });
    });
    return { ok: true, already: false };
  } catch (error) {
    if (error instanceof PaymentHalt) return error.result;
    if (error instanceof GatewayNotConnected) return { ok: false, message: "درگاه پرداخت وصل نیست." };
    const [again] = await db.select().from(payments).where(eq(payments.idempotencyKey, input.idempotencyKey)).limit(1);
    if (again?.status === "verified") {
      if (!samePaymentReplay(again, requested)) return { ok: false, message: "این کلید پرداخت برای سفارش یا مبلغ دیگری است." };
      return { ok: true, already: true };
    }
    if (again && (again.status === "failed" || again.status === "expired")) {
      return { ok: false, message: "این پرداخت قبلاً ناموفق بسته شده است." };
    }
    if (isIdempotencyConflict(error) && again && !samePaymentReplay(again, requested)) {
      return { ok: false, message: "این کلید پرداخت برای سفارش یا مبلغ دیگری است." };
    }
    return { ok: false, message: "تأیید پرداخت انجام نشد و موجودی دوباره کم نشد." };
  }
}

async function recordTerminalPayment(
  db: AppDatabase,
  order: { id: string; customerId: string | null },
  provider: string,
  idempotencyKey: string,
  authority: string,
  status: "failed" | "expired",
): Promise<void> {
  const transition = paymentTransition(null, status === "failed" ? "verify_fail" : "expire");
  if (!transition.ok) return;
  try {
    await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update").limit(1);
      if (!locked || locked.paymentStatus === "verified" || locked.stockState === "captured") return;
      const paymentId = `pay-${crypto.randomUUID()}`;
      await tx.insert(payments).values({
        id: paymentId,
        orderId: locked.id,
        provider,
        status,
        amountIrr: locked.totalIrr,
        currency: PAYMENT_CURRENCY,
        authority: authority || null,
        idempotencyKey,
      });
      await tx.insert(paymentLogs).values({
        id: `plog-${crypto.randomUUID()}`,
        paymentId,
        event: status,
        payload: { provider },
      });
      await writeAudit(tx, {
        actorType: "system",
        actorId: locked.customerId,
        action: status === "failed" ? "payment.failed" : "payment.expired",
        entityType: "order",
        entityId: locked.id,
        metadata: { provider, amountIrr: locked.totalIrr, currency: PAYMENT_CURRENCY },
      });
    });
  } catch (error) {
    if (isIdempotencyConflict(error)) return;
    throw error;
  }
}

async function captureStock(tx: Tx, orderId: string, publicCode: string) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    if (!item.variantId) continue;
    const updated = await tx
      .update(inventory)
      .set({
        onHand: sql`${inventory.onHand} - ${item.quantity}`,
        reserved: sql`${inventory.reserved} - ${item.quantity}`,
        updatedAt: new Date(),
      })
      .where(and(eq(inventory.variantId, item.variantId), sql`${inventory.onHand} >= ${item.quantity}`, sql`${inventory.reserved} >= ${item.quantity}`))
      .returning({ variantId: inventory.variantId, onHand: inventory.onHand, reserved: inventory.reserved });
    if (updated.length === 0) throw new Error("stock_short");
    const after = updated[0]!;
    await tx.insert(inventoryLogs).values({
      id: `ilog-${crypto.randomUUID()}`,
      variantId: item.variantId,
      delta: -item.quantity,
      reason: "capture_paid",
      note: publicCode,
      onHandBefore: after.onHand + item.quantity,
      onHandAfter: after.onHand,
      reservedBefore: after.reserved + item.quantity,
      reservedAfter: after.reserved,
      orderId,
    });
  }
}

/**
 * Re-take stock for an EXPIRED, unpaid order whose payment was verified late.
 *
 * Decision (documented in BATCH_02_REPORT.md): this is a fresh sale of goods the
 * hold had already released, so every line is re-validated against the same
 * availability rule checkout uses (`isLineSellable`: product published and not
 * deleted, variant active, category present, active and not deleted) AND must
 * have sellable stock. A normal `awaiting_payment` order whose hold is still
 * live is not re-validated: that stock was validly reserved at checkout and
 * `captureStock` only converts the reservation. An already paid order never
 * reaches this function (it is rejected earlier as "already paid").
 *
 * Validation happens for all lines before any stock is touched, and any failure
 * throws so the caller's transaction rolls back: no inventory change, no log, no
 * order or payment change, no audit.
 */
async function recoverStock(tx: Tx, orderId: string, publicCode: string) {
  const items = await tx
    .select({
      variantId: orderItems.variantId,
      quantity: orderItems.quantity,
      productId: products.id,
      productStatus: products.status,
      variantStatus: productVariants.status,
      variantDeletedAt: productVariants.deletedAt,
      deletedAt: products.deletedAt,
      categoryActive: productCategories.isActive,
      categoryDeletedAt: productCategories.deletedAt,
    })
    .from(orderItems)
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .where(eq(orderItems.orderId, orderId));
  if (items.length === 0) throw new Error("stock_short");
  for (const item of items) {
    const sellable = isLineSellable({
      productFound: item.productId !== null,
      productStatus: item.productStatus,
      variantStatus: item.variantStatus,
      variantDeletedAt: item.variantDeletedAt,
      productDeletedAt: item.deletedAt,
      categoryActive: item.categoryActive,
      categoryDeletedAt: item.categoryDeletedAt,
    });
    if (!item.variantId || !sellable) throw new Error("stock_short");
  }
  for (const item of items) {
    const variantId = item.variantId as string;
    const updated = await tx
      .update(inventory)
      .set({ onHand: sql`${inventory.onHand} - ${item.quantity}`, updatedAt: new Date() })
      .where(and(eq(inventory.variantId, variantId), sql`(${inventory.onHand} - ${inventory.reserved}) >= ${item.quantity}`))
      .returning({ variantId: inventory.variantId, onHand: inventory.onHand, reserved: inventory.reserved });
    if (updated.length === 0) throw new Error("stock_short");
    const after = updated[0]!;
    await tx.insert(inventoryLogs).values({
      id: `ilog-${crypto.randomUUID()}`,
      variantId,
      delta: -item.quantity,
      reason: "capture_recovered",
      note: publicCode,
      onHandBefore: after.onHand + item.quantity,
      onHandAfter: after.onHand,
      reservedBefore: after.reserved,
      reservedAfter: after.reserved,
      orderId,
    });
  }
}
