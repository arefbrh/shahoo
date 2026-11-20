export const FULFILLMENT_STATUSES = [
  "awaiting_payment",
  "paid",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
  "partially_refunded",
  "expired",
] as const;

const MANUAL: Record<string, readonly string[]> = {
  awaiting_payment: ["cancelled"],
  paid: ["processing"],
  processing: ["ready_to_ship"],
  ready_to_ship: ["shipped"],
  shipped: ["delivered"],
  delivered: ["returned"],
  returned: [],
  partially_refunded: [],
  cancelled: [],
  refunded: [],
  expired: [],
};

/** `paid`, `refunded`, and `cancelled` of a captured order are not silent buttons. */
export function manualNextStatuses(status: string, paymentStatus: string): string[] {
  if (status === "paid") return paymentStatus === "verified" ? ["processing"] : [];
  if (status === "awaiting_payment") return ["cancelled"];
  if (paymentStatus !== "verified" && paymentStatus !== "refund_recorded" && paymentStatus !== "partial_refund_recorded") {
    return [];
  }
  return [...(MANUAL[status] ?? [])].filter((item) => item !== "cancelled" && item !== "refunded" && item !== "partially_refunded");
}

export function canManuallyMove(from: string, to: string, paymentStatus: string): boolean {
  if (to === "paid" || to === "refunded" || to === "partially_refunded") return false;
  if (to === "cancelled" && paymentStatus !== "unpaid") return false;
  return manualNextStatuses(from, paymentStatus).includes(to);
}

/** Paid orders close only through an internal refund ledger, not a bare cancel. */
export function canSettlePaidCancel(status: string, paymentStatus: string): boolean {
  const payable = paymentStatus === "verified" || paymentStatus === "partial_refund_recorded";
  return payable && (status === "paid" || status === "processing" || status === "ready_to_ship");
}

export type RefundKind = "full" | "partial";

export function refundAmount(
  orderTotalIrr: number,
  kind: RefundKind,
  requestedIrr: number,
  alreadyIrr: number,
): { ok: true; amountIrr: number } | { ok: false; message: string } {
  if (!Number.isInteger(orderTotalIrr) || orderTotalIrr < 1) return { ok: false, message: "مبلغ سفارش معتبر نیست." };
  if (!Number.isInteger(alreadyIrr) || alreadyIrr < 0 || alreadyIrr > orderTotalIrr) {
    return { ok: false, message: "مبلغ ثبت‌شده قبلی معتبر نیست." };
  }
  const remaining = orderTotalIrr - alreadyIrr;
  if (remaining < 1) return { ok: false, message: "مبلغ قابل ثبت برای این سفارش باقی نمانده است." };
  if (kind === "full") return { ok: true, amountIrr: remaining };
  if (!Number.isInteger(requestedIrr) || requestedIrr < 1 || requestedIrr > remaining) {
    return { ok: false, message: "مبلغ جزئی باید از یک ریال تا مانده سفارش باشد." };
  }
  return { ok: true, amountIrr: requestedIrr };
}

export function orderStatusAfterRefund(kind: RefundKind, amountIrr: number, orderTotalIrr: number, alreadyIrr: number): "refunded" | "partially_refunded" {
  return alreadyIrr + amountIrr >= orderTotalIrr || kind === "full" ? "refunded" : "partially_refunded";
}

/** Return desk. Receiving goods does not refund a bank and does not restock. */
const RETURN_NEXT: Record<string, readonly string[]> = {
  requested: ["reviewing", "approved", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: ["received"],
  rejected: [],
  received: [],
};

export function canReviewReturn(from: string, to: string): boolean {
  return (RETURN_NEXT[from] ?? []).includes(to);
}
