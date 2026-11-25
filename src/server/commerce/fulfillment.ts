import { onlineReturnsEnabled, todayInTehran } from "../../lib/order-flow";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { canManuallyMove, canReviewReturn, canSettlePaidCancel, orderStatusAfterRefund, refundAmount, type RefundKind } from "@/lib/order-flow";
import { chooseRefundSourcePayment, refundCeiling } from "../../lib/commerce-integrity.ts";
import { hasUnsafeText } from "@/lib/text-safety";
import { writeAudit } from "../auth/audit";
import { requireAdmin, requireCustomer, SessionError } from "../auth/guard";
import { maskMobile } from "../auth/mobile";
import type { AppDatabase } from "../db/client";
import { orderFulfillmentWork, inventory, inventoryLogs, orderEvents, orderItems, orders, paymentLogs, payments, returnEvents, returnRequests, shippingLogs, settings } from "../db/schema";
import { recordNotice } from "../notify/events";
import { orderStatusLabel } from "./pricing";
import { releaseHeldStock } from "./release-hold";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export type ReturnQueueRow = {
  id: string;
  status: string;
  reason: string;
  amountIrr: number;
  note: string;
  orderCode: string;
  orderStatus: string;
  updatedAt: Date;
  history: { status: string; note: string; actor: string; createdAt: Date }[];
};

async function loadReturnRow(tx: DbTx, id: string): Promise<ReturnQueueRow | null> {
  const [row] = await tx.select().from(returnRequests).where(eq(returnRequests.id, id)).limit(1);
  if (!row) return null;
  const [order] = await tx
    .select({ publicCode: orders.publicCode, status: orders.status })
    .from(orders)
    .where(eq(orders.id, row.orderId))
    .limit(1);
  const events = await tx.select().from(returnEvents).where(eq(returnEvents.returnId, id)).orderBy(asc(returnEvents.createdAt));
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    amountIrr: Number(row.amountIrr),
    note: row.note,
    orderCode: order?.publicCode ?? "",
    orderStatus: order?.status ?? "",
    updatedAt: row.updatedAt,
    history: events.map((event) => ({ status: event.status, note: event.note, actor: event.actor, createdAt: event.createdAt })),
  };
}

function clean(value: string, max: number): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length > max || hasUnsafeText(text)) return null;
  return text;
}

async function packingHasExpiredLot(tx: DbTx, orderId: string) {
  const [work] = await tx.select({ items: orderFulfillmentWork.pickedItems }).from(orderFulfillmentWork)
    .where(eq(orderFulfillmentWork.orderId, orderId)).limit(1);
  const today = todayInTehran();
  return work?.items.some((item) => item.pickedQuantity > 0 && item.expiresOn && item.expiresOn < today);
}

export async function moveOrderStatus(db: AppDatabase, actorId: string, publicCode: string, next: string, reason: string) {
  const text = clean(reason, 400);
  if (!text || text.length < 2) return { ok: false as const, message: "دلیل تغییر وضعیت را وارد کنید." };
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.publicCode, publicCode)).for("update").limit(1);
    if (!order) return { ok: false as const, message: "سفارش پیدا نشد." };
    if (next === "paid" || !canManuallyMove(order.status, next, order.paymentStatus)) {
      return { ok: false as const, message: "این تغییر وضعیت مجاز نیست." };
    }
    if (next === "shipped" && await packingHasExpiredLot(tx, order.id)) return { ok: false as const, message: "سری منقضی را پیش از ارسال جایگزین کنید." };
    if (next === "cancelled" && order.paymentStatus !== "unpaid") {
      return { ok: false as const, message: "سفارش پرداخت‌شده را فقط با ثبت استرداد داخلی لغو کنید." };
    }
    if (next === "cancelled" && order.stockState === "held") {
      await releaseHeldStock(tx, order, "release_cancelled", actorId);
      await tx.update(orders).set({ status: "cancelled", stockState: "released", stockHoldUntil: null, updatedAt: new Date() }).where(eq(orders.id, order.id));
    } else if (next === "cancelled") {
      return { ok: false as const, message: "این لغو با وضعیت موجودی سازگار نیست." };
    } else {
      await tx.update(orders).set({ status: next, updatedAt: new Date() }).where(eq(orders.id, order.id));
    }
    await tx.insert(orderEvents).values({
      id: `oev-${crypto.randomUUID()}`,
      orderId: order.id,
      status: next,
      note: `وضعیت به «${orderStatusLabel(next)}» تغییر کرد. دلیل: ${text}`,
      actor: "admin",
    });
    await recordNotice(tx, {
      eventKey: "order.status",
      detail: `${order.publicCode} ${orderStatusLabel(next)}`,
      recipient: order.mobile,
      customerId: order.customerId,
      orderId: order.id,
    });
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "order.status",
      entityType: "order",
      entityId: order.id,
      metadata: { from: order.status, to: next, reason: text, mobile: maskMobile(order.mobile) },
    });
    return { ok: true as const };
  });
}

async function restockCaptured(tx: DbTx, orderId: string, publicCode: string, actorId: string): Promise<boolean> {
  const claimed = await tx
    .update(orders)
    .set({ stockState: "restocked", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.stockState, "captured")))
    .returning({ id: orders.id });
  if (claimed.length === 0) return false;
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    if (!item.variantId) continue;
    const updated = await tx
      .update(inventory)
      .set({ onHand: sql`${inventory.onHand} + ${item.quantity}`, updatedAt: new Date() })
      .where(eq(inventory.variantId, item.variantId))
      .returning({ onHand: inventory.onHand, reserved: inventory.reserved });
    const after = updated[0];
    if (!after) throw new Error("restock_inventory_missing");
    await tx.insert(inventoryLogs).values({
      id: `ilog-${crypto.randomUUID()}`,
      variantId: item.variantId,
      delta: item.quantity,
      reason: "restock_cancel",
      note: publicCode,
      actorAdminId: actorId,
      onHandBefore: after.onHand - item.quantity,
      onHandAfter: after.onHand,
      reservedBefore: after.reserved,
      reservedAfter: after.reserved,
      orderId,
    });
  }
  return true;
}

export async function recordShipment(
  db: AppDatabase,
  actorId: string,
  publicCode: string,
  input: { carrier: string; trackingCode: string; note: string; handedOffAt: string | null },
) {
  const carrier = clean(input.carrier, 40);
  const trackingCode = clean(input.trackingCode, 60);
  const note = clean(input.note, 300);
  if (carrier === null || trackingCode === null || note === null || !carrier || note.length < 2) return { ok: false as const, message: "شرکت حمل و دلیل ثبت/اصلاح ارسال را وارد کنید." };
  const handed = input.handedOffAt ? new Date(input.handedOffAt) : new Date();
  if (Number.isNaN(handed.getTime())) return { ok: false as const, message: "زمان تحویل به شرکت حمل معتبر نیست." };
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.publicCode, publicCode)).for("update").limit(1);
    if (!order) return { ok: false as const, message: "سفارش پیدا نشد." };
    if (order.paymentStatus !== "verified") return { ok: false as const, message: "تا تأیید پرداخت، ارسال ثبت نمی‌شود." };
    if (!["ready_to_ship", "shipped", "delivered"].includes(order.status)) {
      return { ok: false as const, message: "سفارش هنوز آماده ثبت ارسال نیست." };
    }
    if (order.status === "ready_to_ship" && await packingHasExpiredLot(tx, order.id)) return { ok: false as const, message: "سری منقضی را پیش از ارسال جایگزین کنید." };
    const [senderSetting] = await tx.select({ value: settings.value }).from(settings).where(eq(settings.key, "shipping.sender_profile")).limit(1);
    const rawSender = senderSetting?.value && typeof senderSetting.value === "object" ? senderSetting.value as Record<string, unknown> : {};
    const senderSnapshot = {
      name: typeof rawSender.name === "string" ? rawSender.name : "",
      phone: typeof rawSender.phone === "string" ? rawSender.phone : "",
      province: typeof rawSender.province === "string" ? rawSender.province : "",
      city: typeof rawSender.city === "string" ? rawSender.city : "",
      address: typeof rawSender.address === "string" ? rawSender.address : "",
      postalCode: typeof rawSender.postalCode === "string" ? rawSender.postalCode : "",
    };
    const recipientSnapshot = {
      name: order.fullName, phone: order.mobile, province: order.province, city: order.city,
      address: order.addressLine, postalCode: order.postalCode, plaque: order.plaque, unit: order.unit,
    };
    if (!senderSnapshot.name || !senderSnapshot.phone || !senderSnapshot.address || !senderSnapshot.city) {
      return { ok: false as const, message: "ابتدا مشخصات کامل فرستنده را در تنظیمات ارسال ثبت کنید." };
    }
    await tx.insert(shippingLogs).values({
      id: `shp-${crypto.randomUUID()}`,
      orderId: order.id,
      status: order.status === "ready_to_ship" ? "shipped" : order.status,
      trackingCode: trackingCode || null,
      note: note || "",
      carrier,
      handedOffAt: handed,
      senderSnapshot,
      recipientSnapshot,
      actor: "admin",
    });
    await tx.update(orders).set({
      trackingCode: trackingCode || order.trackingCode,
      status: order.status === "ready_to_ship" ? "shipped" : order.status,
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({
      id: `oev-${crypto.randomUUID()}`,
      orderId: order.id,
      status: order.status === "ready_to_ship" ? "shipped" : order.status,
      note: `ارسال دستی: ${carrier}${trackingCode ? ` / ${trackingCode}` : ""}. دلیل: ${note}`,
      actor: "admin",
    });
    await recordNotice(tx, {
      eventKey: "order.shipment",
      detail: `${order.publicCode} ${carrier}`,
      recipient: order.mobile,
      customerId: order.customerId,
      orderId: order.id,
    });
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "order.shipment",
      entityType: "order",
      entityId: order.id,
      metadata: { carrier, reason: note },
    });
    return { ok: true as const };
  });
}

export async function requestReturn(db: AppDatabase, customerId: string, publicCode: string, reason: string) {
  const text = clean(reason, 400);
  if (!text || text.length < 8) return { ok: false as const, message: "دلیل مرجوعی را کامل بنویسید." };
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.publicCode, publicCode)).for("update").limit(1);
    if (!order || order.customerId !== customerId) return { ok: false as const, message: "این سفارش برای حساب شما نیست." };
    if (order.status !== "delivered") return { ok: false as const, message: "درخواست مرجوعی فقط بعد از تحویل ثبت می‌شود." };
    const existing = await tx.select({ status: returnRequests.status }).from(returnRequests).where(eq(returnRequests.orderId, order.id));
    if (existing.some((row) => row.status !== "rejected")) {
      return { ok: false as const, message: "برای این سفارش یک درخواست مرجوعی باز است." };
    }
    const id = `ret-${crypto.randomUUID()}`;
    await tx.insert(returnRequests).values({ id, orderId: order.id, customerId, reason: text, status: "requested", amountIrr: 0 });
    await tx.insert(returnEvents).values({ id: `revt-${crypto.randomUUID()}`, returnId: id, status: "requested", note: text, actor: "customer" });
    await recordNotice(tx, {
      eventKey: "order.return",
      detail: `${order.publicCode} ثبت شد`,
      recipient: order.mobile,
      customerId,
      orderId: order.id,
    });
    return { ok: true as const };
  });
}

export async function reviewReturn(
  db: AppDatabase,
  actorId: string,
  id: string,
  status: "reviewing" | "approved" | "rejected" | "received",
  note: string,
) {
  const text = clean(note, 400);
  if (text === null || text.length < 2) return { ok: false as const, message: "دلیل بررسی مرجوعی را وارد کنید." };
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(returnRequests).where(eq(returnRequests.id, id)).for("update").limit(1);
    if (!row) return { ok: false as const, message: "درخواست مرجوعی پیدا نشد." };
    if (row.status === status) return { ok: false as const, message: "این وضعیت قبلاً ثبت شده است." };
    if (!canReviewReturn(row.status, status)) return { ok: false as const, message: "این تغییر وضعیت مرجوعی مجاز نیست." };
    const [order] = await tx.select().from(orders).where(eq(orders.id, row.orderId)).for("update").limit(1);
    await tx.update(returnRequests).set({ status, note: text, updatedAt: new Date() }).where(eq(returnRequests.id, id));
    if (status === "received" && order && order.status === "delivered") {
      await tx.update(orders).set({ status: "returned", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({
        id: `oev-${crypto.randomUUID()}`,
        orderId: order.id,
        status: "returned",
        note: "کالای مرجوعی دریافت شد. موجودی و درگاه عوض نشده‌اند.",
        actor: "admin",
      });
    }
    await tx.insert(returnEvents).values({ id: `revt-${crypto.randomUUID()}`, returnId: id, status, note: text, actor: "admin" });
    await writeAudit(tx, { actorType: "admin", actorId, action: "return.reviewed", entityType: "return_request", entityId: id, metadata: { status, from: row.status, reason: text } });
    const fresh = await loadReturnRow(tx, id);
    if (!fresh) return { ok: false as const, message: "درخواست مرجوعی پیدا نشد." };
    return { ok: true as const, row: fresh };
  });
}

export async function recordRefund(
  db: AppDatabase,
  actorId: string,
  id: string,
  kind: RefundKind,
  requestedIrr: number,
  reason: string,
  options?: { restock?: boolean; paymentId?: string },
) {
  const text = clean(reason, 400);
  if (!text || text.length < 2) return { ok: false as const, message: "دلیل ثبت استرداد را وارد کنید." };
  try {
    return await db.transaction(async (tx) => {
    const [row] = await tx.select().from(returnRequests).where(eq(returnRequests.id, id)).for("update").limit(1);
    if (!row || !["approved", "received"].includes(row.status)) return { ok: false as const, message: "مرجوعی هنوز برای ثبت مبلغ آماده نیست." };
    if (Number(row.amountIrr) > 0) {
      const fresh = await loadReturnRow(tx, id);
      return fresh
        ? { ok: true as const, already: true, message: "این استرداد قبلاً ثبت شده است.", row: fresh }
        : { ok: true as const, already: true, message: "این استرداد قبلاً ثبت شده است." };
    }
    const [order] = await tx.select().from(orders).where(eq(orders.id, row.orderId)).for("update").limit(1);
    if (!order || order.paymentStatus === "unpaid") return { ok: false as const, message: "پرداخت تأییدشده‌ای برای ثبت استرداد نیست." };
    if (order.paymentStatus === "refund_recorded") return { ok: false as const, message: "استرداد این سفارش قبلاً کامل شده است." };
    const verifiedPayments = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, order.id), eq(payments.status, "verified")));
    if (options?.paymentId && !verifiedPayments.some((row) => row.id === options.paymentId)) {
      return { ok: false as const, message: "این پرداخت به سفارش مربوط نیست." };
    }
    const verifiedPaid = verifiedPayments.length
      ? verifiedPayments.reduce((sum, row) => sum + Number(row.amountIrr), 0)
      : null;
    if (verifiedPaid !== null && verifiedPaid < 1) return { ok: false as const, message: "پرداخت تأییدشده‌ای برای ثبت استرداد نیست." };
    const ceiling = refundCeiling(Number(order.totalIrr), verifiedPaid);
    const previous = await tx.select({ amountIrr: returnRequests.amountIrr }).from(returnRequests).where(eq(returnRequests.orderId, order.id));
    const already = Math.max(0, previous.reduce((sum, item) => sum + Number(item.amountIrr), 0) - Number(row.amountIrr));
    const amount = refundAmount(ceiling, kind, requestedIrr, already);
    if (!amount.ok) return amount;
    const nextStatus = orderStatusAfterRefund(kind, amount.amountIrr, ceiling, already);
    if (options?.restock && nextStatus !== "refunded") {
      return { ok: false as const, message: "بازگشت موجودی فقط همراه با استرداد کامل ثبت می‌شود." };
    }
    const claimed = await tx
      .update(returnRequests)
      .set({ status: "received", refundKind: kind, amountIrr: amount.amountIrr, note: text, updatedAt: new Date() })
      .where(and(eq(returnRequests.id, id), eq(returnRequests.amountIrr, 0)))
      .returning({ id: returnRequests.id });
    if (claimed.length === 0) {
      const fresh = await loadReturnRow(tx, id);
      return fresh
        ? { ok: true as const, already: true, message: "این استرداد قبلاً ثبت شده است.", row: fresh }
        : { ok: true as const, already: true, message: "این استرداد قبلاً ثبت شده است." };
    }
    const saved = await tx
      .update(orders)
      .set({
        status: nextStatus,
        paymentStatus: nextStatus === "refunded" ? "refund_recorded" : "partial_refund_recorded",
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, order.id), sql`${ceiling} >= (select coalesce(sum(amount_irr), 0) from return_requests where order_id = ${orders.id})`))
      .returning({ id: orders.id });
    if (saved.length === 0) throw new Error("refund_ceiling");
    if (options?.restock && nextStatus === "refunded") await restockCaptured(tx, order.id, order.publicCode, actorId);
    const sourcePaymentId = options?.paymentId ?? (verifiedPayments.length === 1 ? verifiedPayments[0]?.id ?? null : null);
    await tx.insert(payments).values({
      id: `pay-${crypto.randomUUID()}`,
      orderId: order.id,
      provider: "ledger",
      status: nextStatus === "refunded" ? "refund_recorded" : "partial_refund_recorded",
      amountIrr: amount.amountIrr,
      currency: "IRR",
      idempotencyKey: `ledger-return-${id}`,
      refundOfPaymentId: sourcePaymentId,
    });
    await tx.insert(returnEvents).values({
      id: `revt-${crypto.randomUUID()}`,
      returnId: id,
      status: nextStatus,
      note: `${text}. مبلغ فقط در دفتر ثبت شد؛ بازپرداخت واقعی به درگاه فرستاده نشده است.`,
      actor: "admin",
    });
    await tx.insert(orderEvents).values({
      id: `oev-${crypto.randomUUID()}`,
      orderId: order.id,
      status: nextStatus,
      note: `${text}. وضعیت استرداد در دفتر ثبت شد؛ هیچ درگاهی فراخوانی نشده است.`,
      actor: "admin",
    });
    await recordNotice(tx, {
      eventKey: "order.return",
      detail: `${order.publicCode} ثبت دفتری`,
      recipient: order.mobile,
      customerId: order.customerId,
      orderId: order.id,
    });
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "return.recorded",
      entityType: "return_request",
      entityId: id,
      metadata: { amountIrr: amount.amountIrr, gateway: false, reason: text },
    });
    const fresh = await loadReturnRow(tx, id);
    if (!fresh) throw new Error("return_row_missing");
    return { ok: true as const, already: false, message: "مبلغ در دفتر ثبت شد. بازپرداخت واقعی انجام نشده است.", row: fresh };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "refund_ceiling") {
      return { ok: false as const, message: "مجموع استرداد از مبلغ سفارش بیشتر می‌شود." };
    }
    throw error;
  }
}

export async function settlePaidCancel(db: AppDatabase, actorId: string, publicCode: string, reason: string) {
  const text = clean(reason, 400);
  if (!text || text.length < 2) return { ok: false as const, message: "دلیل لغو و ثبت استرداد را وارد کنید." };
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.publicCode, publicCode)).for("update").limit(1);
    if (!order) return { ok: false as const, message: "سفارش پیدا نشد." };
    if (order.paymentStatus === "refund_recorded" || order.status === "refunded" || order.status === "cancelled") {
      return { ok: true as const, already: true, message: "این سفارش قبلاً تعیین‌تکلیف شده است." };
    }
    if (!canSettlePaidCancel(order.status, order.paymentStatus)) {
      return { ok: false as const, message: "این سفارش را با لغو عادی یا مسیر مرجوعی ببندید." };
    }
    const previous = await tx.select({ amountIrr: returnRequests.amountIrr }).from(returnRequests).where(eq(returnRequests.orderId, order.id));
    const already = previous.reduce((sum, item) => sum + Number(item.amountIrr), 0);
    const orderPayments = await tx.select().from(payments).where(eq(payments.orderId, order.id));
    const verifiedPayments = orderPayments.filter((item) => item.status === "verified");
    const verifiedPaid = verifiedPayments.length ? verifiedPayments.reduce((sum, item) => sum + Number(item.amountIrr), 0) : null;
    const amount = refundAmount(refundCeiling(Number(order.totalIrr), verifiedPaid), "full", 0, already);
    if (!amount.ok) return amount;
    // Link the ledger refund to its verified source payment. Fails before any mutation.
    const source = chooseRefundSourcePayment(order.id, amount.amountIrr, orderPayments);
    if (!source.ok) {
      return {
        ok: false as const,
        message:
          source.reason === "none"
            ? "پرداخت تأییدشده‌ای برای پیوند استرداد پیدا نشد. سفارش تغییر نکرد."
            : source.reason === "ambiguous"
              ? "بیش از یک پرداخت تأییدشده دارد؛ پیوند استرداد باید دستی بررسی شود. سفارش تغییر نکرد."
              : "مبلغ استرداد از پرداخت تأییدشده بیشتر است. سفارش تغییر نکرد.",
      };
    }
    let stockState = order.stockState;
    if (order.stockState === "captured") {
      const restocked = await restockCaptured(tx, order.id, order.publicCode, actorId);
      stockState = restocked ? "restocked" : order.stockState;
    } else if (order.stockState === "held") {
      await releaseHeldStock(tx, order, "release_cancelled", actorId);
      stockState = "released";
    }
    const returnId = `ret-${crypto.randomUUID()}`;
    await tx.insert(returnRequests).values({
      id: returnId,
      orderId: order.id,
      customerId: order.customerId,
      reason: text,
      status: "received",
      refundKind: "full",
      amountIrr: amount.amountIrr,
      note: `${text}. بازپرداخت بانکی انجام نشده است.`,
    });
    const paymentId = `pay-${crypto.randomUUID()}`;
    await tx.insert(payments).values({
      id: paymentId,
      orderId: order.id,
      provider: "ledger",
      status: "refund_recorded",
      amountIrr: amount.amountIrr,
      currency: "IRR",
      refundOfPaymentId: source.paymentId,
      idempotencyKey: `ledger-cancel-${order.id}`,
    });
    await tx.insert(paymentLogs).values({
      id: `plog-${crypto.randomUUID()}`,
      paymentId,
      event: "refund_recorded",
      payload: { gateway: false, amountIrr: amount.amountIrr },
    });
    await tx.update(orders).set({
      status: "refunded",
      paymentStatus: "refund_recorded",
      stockState,
      stockHoldUntil: null,
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({
      id: `oev-${crypto.randomUUID()}`,
      orderId: order.id,
      status: "refunded",
      note: `لغو با دلیل «${text}» در دفتر ثبت شد. هیچ درگاهی فراخوانی نشده است.`,
      actor: "admin",
    });
    await recordNotice(tx, {
      eventKey: "order.return",
      detail: `${order.publicCode} لغو داخلی`,
      recipient: order.mobile,
      customerId: order.customerId,
      orderId: order.id,
    });
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "order.settled_cancel",
      entityType: "order",
      entityId: order.id,
      metadata: { amountIrr: amount.amountIrr, gateway: false, stockState, reason: text },
    });
    return { ok: true as const, already: false, message: "سفارش بسته شد و استرداد فقط در دفتر ثبت شد." };
  });
}

export async function latestShipment(db: AppDatabase, orderId: string) {
  const [row] = await db.select().from(shippingLogs).where(eq(shippingLogs.orderId, orderId)).orderBy(desc(shippingLogs.createdAt)).limit(1);
  return row ?? null;
}

export async function moveOrderForAdmin(publicCode: string, next: string, reason: string) {
  try {
    const { db, admin } = await requireAdmin("orders.write");
    return await moveOrderStatus(db, admin.id, publicCode, next, reason);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "تغییر وضعیت انجام نشد." };
  }
}

export async function shipmentForAdmin(publicCode: string, input: { carrier: string; trackingCode: string; note: string; handedOffAt: string | null }) {
  try {
    const { db, admin } = await requireAdmin("orders.write");
    return await recordShipment(db, admin.id, publicCode, input);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "ثبت ارسال انجام نشد." };
  }
}

export async function returnForCustomer(publicCode: string, reason: string) {
  if (!onlineReturnsEnabled) return { ok: false as const, message: "مرجوعی از طریق تماس با فروشگاه پیگیری می‌شود." };
  try {
    const { db, customer } = await requireCustomer();
    return await requestReturn(db, customer.id, publicCode, reason);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "ثبت مرجوعی انجام نشد." };
  }
}

export async function reviewReturnForAdmin(id: string, status: "reviewing" | "approved" | "rejected" | "received", note: string) {
  if (!onlineReturnsEnabled) return { ok: false as const, message: "مرجوعی از طریق تماس با فروشگاه پیگیری می‌شود." };
  try {
    const { db, admin } = await requireAdmin("orders.write");
    return await reviewReturn(db, admin.id, id, status, note);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "بررسی مرجوعی انجام نشد." };
  }
}

export async function settlePaidCancelForAdmin(publicCode: string, reason: string) {
  try {
    const { db, admin } = await requireAdmin("orders.write");
    return await settlePaidCancel(db, admin.id, publicCode, reason);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "لغو با استرداد داخلی انجام نشد." };
  }
}

export async function refundForAdmin(id: string, kind: RefundKind, requestedIrr: number, reason: string) {
  if (!onlineReturnsEnabled) return { ok: false as const, message: "مرجوعی از طریق تماس با فروشگاه پیگیری می‌شود." };
  try {
    const { db, admin } = await requireAdmin("orders.write");
    return await recordRefund(db, admin.id, id, kind, requestedIrr, reason);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "ثبت مبلغ انجام نشد." };
  }
}

export async function returnQueue() {
  if (!onlineReturnsEnabled) return { ok: true as const, rows: [] };
  try {
    const { db } = await requireAdmin("orders.read");
    const rows = await db
      .select({
        id: returnRequests.id,
        status: returnRequests.status,
        reason: returnRequests.reason,
        amountIrr: returnRequests.amountIrr,
        note: returnRequests.note,
        orderCode: orders.publicCode,
        orderStatus: orders.status,
        updatedAt: returnRequests.updatedAt,
      })
      .from(returnRequests)
      .innerJoin(orders, eq(orders.id, returnRequests.orderId))
      .orderBy(desc(returnRequests.updatedAt))
      .limit(40);
    const ids = rows.map((row) => row.id);
    const events = ids.length
      ? await db.select().from(returnEvents).where(inArray(returnEvents.returnId, ids)).orderBy(asc(returnEvents.createdAt))
      : [];
    const history = new Map<string, ReturnQueueRow["history"]>();
    for (const event of events) {
      const list = history.get(event.returnId) ?? [];
      list.push({ status: event.status, note: event.note, actor: event.actor, createdAt: event.createdAt });
      history.set(event.returnId, list);
    }
    return {
      ok: true as const,
      rows: rows.map((row) => ({
        ...row,
        amountIrr: Number(row.amountIrr),
        history: history.get(row.id) ?? [],
      })),
    };
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message, rows: [] };
    return { ok: false as const, message: "فهرست مرجوعی خوانده نشد.", rows: [] };
  }
}
