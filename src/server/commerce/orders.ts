import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { OrderSummary, OrderView } from "@/lib/commerce-types";
import { staffOnlyOrderNote } from "@/lib/order-display";
import { readReceiptPairs, readReceiptToken } from "../auth/cookies";
import { hashSessionToken } from "../auth/crypto";
import { openDb } from "../auth/db";
import { maskMobile } from "../auth/mobile";
import { readAdmin, readCustomer } from "../auth/sessions";
import type { AppDatabase } from "../db/client";
import { orderEvents, orderItems, orders, paymentAttempts } from "../db/schema";
import { releaseExpiredHolds, timeValue } from "./holds";
import { orderStatusLabel, paymentStatusLabel } from "./pricing";
import { canSettlePaidCancel, manualNextStatuses, onlineReturnsEnabled } from "@/lib/order-flow";
import { latestShipment } from "./fulfillment";

export async function customerOrderSummaries(db: AppDatabase, customerId: string): Promise<OrderSummary[]> {
  await releaseExpiredHolds(db);
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt))
    .limit(20);
  return withCounts(db, rows, false);
}

export async function recentOrders(db: AppDatabase): Promise<OrderSummary[]> {
  await releaseExpiredHolds(db);
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
  return withCounts(db, rows, true);
}

export async function attachReceiptOrders(db: AppDatabase, customer: { id: string; mobile: string }): Promise<void> {
  for (const pair of readReceiptPairs()) {
    const [order] = await db.select().from(orders).where(eq(orders.publicCode, pair.publicCode)).limit(1);
    if (!order || order.customerId || order.mobile !== customer.mobile) continue;
    if (!order.accessTokenHash || order.accessTokenHash !== hashSessionToken(pair.token)) continue;
    await db
      .update(orders)
      .set({ customerId: customer.id, updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), isNull(orders.customerId)));
  }
}

export async function loadOrder(publicCode: string): Promise<OrderView | null> {
  if (!/^SH-\d{8}-[A-Z0-9]{4}$/.test(publicCode)) return null;
  const db = await openDb();
  await releaseExpiredHolds(db);
  const [order] = await db.select().from(orders).where(eq(orders.publicCode, publicCode)).limit(1);
  if (!order) return null;
  const customer = await readCustomer(db);
  const admin = await readAdmin(db);
  const receipt = readReceiptToken(publicCode);
  const owns = Boolean(customer && order.customerId === customer.id);
  const staff = Boolean(admin?.permissions.includes("orders.read"));
  const canManagePayments = Boolean(admin?.permissions.includes("orders.write"));
  const receiptOk = Boolean(receipt && order.accessTokenHash && order.accessTokenHash === hashSessionToken(receipt));
  const seeContact = Boolean(owns || receiptOk || admin?.permissions.includes("customers.read"));
  if (!owns && !staff && !receiptOk) return null;

  const [lines, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(desc(orderEvents.createdAt)),
  ]);
  const hold = timeValue(order.stockHoldUntil);
  const shipment = await latestShipment(db, order.id);
  const paymentRecovery = staff || canManagePayments
    ? await db.select({
        id: paymentAttempts.id,
        provider: paymentAttempts.provider,
        state: paymentAttempts.state,
        amountIrr: paymentAttempts.amountIrr,
        reconciliationRequired: paymentAttempts.reconciliationRequired,
        settlementError: paymentAttempts.settlementError,
        verificationPaymentRefId: paymentAttempts.verificationPaymentRefId,
        providerReferenceId: paymentAttempts.providerReferenceId,
        verifiedAt: paymentAttempts.verifiedAt,
        createdAt: paymentAttempts.createdAt,
      }).from(paymentAttempts).where(eq(paymentAttempts.orderId, order.id)).orderBy(desc(paymentAttempts.createdAt))
    : [];
  const paid = order.paymentStatus === "verified" || order.paymentStatus === "refund_recorded" || order.paymentStatus === "partial_refund_recorded";
  return {
    publicCode: order.publicCode,
    statusLabel: orderStatusLabel(order.status),
    paymentStatusLabel: paymentStatusLabel(order.paymentStatus),
    isPaid: paid,
    isClosed: ["cancelled", "expired", "returned", "refunded", "refund_recorded", "partial_refund_recorded", "partially_refunded"].includes(order.status),
    fullName: seeContact ? order.fullName : "مشتری",
    mobile: seeContact ? order.mobile : maskMobile(order.mobile),
    province: order.province,
    city: order.city,
    addressLine: seeContact ? order.addressLine : "نشانی فقط با دسترسی مشتریان دیده می‌شود.",
    postalCode: seeContact ? order.postalCode : "",
    plaque: seeContact ? order.plaque : "",
    unit: seeContact ? order.unit : "",
    customerNote: order.customerNote,
    shippingTitle: order.shippingTitle,
    subtotalIrr: order.subtotalIrr,
    discountIrr: order.discountIrr,
    shippingIrr: order.shippingIrr,
    totalIrr: order.totalIrr,
    couponCode: order.couponCode,
    createdAtLabel: formatFaDate(order.createdAt),
    holdUntilLabel: order.status === "awaiting_payment" && hold ? formatFaDate(hold) : null,
    paymentNote: paid
      ? `وضعیت مالی ثبت‌شده برای این سفارش: ${paymentStatusLabel(order.paymentStatus)}.`
      : "پرداخت تأیید نشده است. برای پیگیری، کد سفارش را به پشتیبانی اعلام کنید.",
    trackingCode: shipment?.trackingCode ?? order.trackingCode,
    carrier: shipment?.carrier ?? "",
    shipmentNote: staffOnlyOrderNote(shipment?.note, staff),
    canRequestReturn: Boolean(onlineReturnsEnabled && owns && order.status === "delivered"),
    canSettleCancel: Boolean(admin?.permissions.includes("orders.write") && canSettlePaidCancel(order.status, order.paymentStatus)),
    nextStatuses: staff && admin?.permissions.includes("orders.write") ? manualNextStatuses(order.status, order.paymentStatus) : [],
    lines: lines.map((line) => ({
      id: line.id,
      name: line.productName,
      label: line.variantLabel,
      sku: line.sku,
      quantity: line.quantity,
      unitPriceIrr: line.unitPriceIrr,
      lineTotalIrr: line.lineTotalIrr,
    })),
    events: events.map((event) => ({
      id: event.id,
      statusLabel: orderStatusLabel(event.status),
      note: staffOnlyOrderNote(event.note, staff),
      createdAtLabel: formatFaDate(event.createdAt),
    })),
    canCancel: Boolean(admin?.permissions.includes("orders.write") && order.status === "awaiting_payment"),
    canManagePayments,
    paymentRecovery: paymentRecovery.map((attempt) => ({
      id: attempt.id,
      provider: attempt.provider,
      state: attempt.state,
      amountIrr: Number(attempt.amountIrr),
      reconciliationRequired: attempt.reconciliationRequired,
      settlementError: attempt.settlementError,
      verificationReady: attempt.verificationPaymentRefId !== null,
      settlementReady: Boolean(attempt.providerReferenceId && attempt.verifiedAt),
      createdAtLabel: formatFaDate(attempt.createdAt),
    })),
    staffNote: staff
      ? order.couponId
        ? "تخفیف این سفارش به شناسه پایدار کوپن وصل است، نه فقط به متن کد."
        : order.couponCode
          ? "این سفارش فقط متن کد تخفیف را دارد و به شناسه کوپن وصل نشده است."
          : null
      : null,
  };
}

async function withCounts(
  db: AppDatabase,
  rows: Array<{
    id: string;
    publicCode: string;
    status: string;
    paymentStatus: string;
    totalIrr: number;
    mobile: string;
    createdAt: Date | string;
  }>,
  includeMaskedMobile: boolean,
): Promise<OrderSummary[]> {
  if (rows.length === 0) return [];
  const counts = await db
    .select({ orderId: orderItems.orderId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((row) => row.id),
      ),
    );
  const totals = new Map<string, number>();
  for (const row of counts) totals.set(row.orderId, (totals.get(row.orderId) ?? 0) + row.quantity);
  return rows.map((row) => ({
    publicCode: row.publicCode,
    statusLabel: orderStatusLabel(row.status),
    paymentStatusLabel: paymentStatusLabel(row.paymentStatus),
    totalIrr: row.totalIrr,
    itemCount: totals.get(row.id) ?? 0,
    createdAtLabel: formatFaDate(row.createdAt),
    ...(includeMaskedMobile ? { mobileMasked: maskMobile(row.mobile) } : {}),
  }));
}

function formatFaDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
