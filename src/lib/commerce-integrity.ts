import { clampLineQuantity } from "../server/commerce/pricing.ts";

/** Guest cart joins the customer cart once. A later call must not add the same units again. */
export type CartMergeMode = "sum" | "max";

/**
 * `sum` is the one-time guest→customer merge.
 * `max` is a repeated local-cart adopt: the same payload must not raise the line twice.
 * Both clamp to sellable stock and the shop line cap. Zero means the line cannot be kept.
 */
export function combinedCartQuantity(
  existing: number,
  incoming: number,
  sellable: number,
  mode: CartMergeMode,
): number {
  const current = Number.isInteger(existing) && existing > 0 ? existing : 0;
  const added = Number.isInteger(incoming) && incoming > 0 ? incoming : 0;
  const base = mode === "sum" ? current + added : Math.max(current, added);
  return clampLineQuantity(base, sellable);
}

/**
 * The one availability rule for an order line, shared by checkout and by
 * expired-order stock recovery so the two cannot drift. A line is sellable only
 * when the product is published and not deleted, the variant is active, and the
 * product's category exists, is active and is not deleted. A missing row
 * (null/undefined, e.g. a left join that found nothing) is never sellable.
 */
export function isLineSellable(line: {
  productStatus: string | null | undefined;
  variantStatus: string | null | undefined;
  variantDeletedAt?: Date | string | null;
  productDeletedAt: Date | null | undefined;
  categoryActive: boolean | null | undefined;
  categoryDeletedAt: Date | null | undefined;
  /** true when the product row itself was found */
  productFound?: boolean;
}): boolean {
  if (line.productFound === false) return false;
  return (
    line.productStatus === "published" &&
    line.variantStatus === "active" &&
    !line.variantDeletedAt &&
    !line.productDeletedAt &&
    line.categoryActive === true &&
    !line.categoryDeletedAt
  );
}

const CHECKOUT_KEY = /^[A-Za-z0-9._:-]{1,80}$/;

export function checkoutIdempotencyKey(input: string): string | null {
  const key = input.trim();
  if (!CHECKOUT_KEY.test(key)) return null;
  return key;
}

export type PaymentLifecycle = "pending" | "verified" | "failed" | "expired";
export type PaymentEvent = "verify_ok" | "verify_fail" | "expire";

/** Verified and failed/expired payments are terminal. A new attempt needs a new idempotency key. */
export function paymentTransition(
  current: string | null,
  event: PaymentEvent,
): { ok: true; status: PaymentLifecycle; idempotent: boolean } | { ok: false; message: string } {
  const blocked = "تغییر وضعیت این پرداخت مجاز نیست.";
  if (current === null || current === "pending") {
    if (event === "verify_ok") return { ok: true, status: "verified", idempotent: false };
    if (event === "verify_fail") return { ok: true, status: "failed", idempotent: false };
    return { ok: true, status: "expired", idempotent: false };
  }
  if (current === "verified") {
    if (event === "verify_ok") return { ok: true, status: "verified", idempotent: true };
    return { ok: false, message: blocked };
  }
  if (current === "failed") {
    if (event === "verify_fail") return { ok: true, status: "failed", idempotent: true };
    return { ok: false, message: blocked };
  }
  if (current === "expired") {
    if (event === "expire") return { ok: true, status: "expired", idempotent: true };
    return { ok: false, message: blocked };
  }
  return { ok: false, message: blocked };
}

/** Null verified sum means no payment row exists yet, so the order total remains the ceiling. */
export function refundCeiling(orderTotalIrr: number, verifiedPaidIrr: number | null): number {
  if (!Number.isInteger(orderTotalIrr) || orderTotalIrr < 0) return 0;
  if (verifiedPaidIrr === null) return orderTotalIrr;
  if (!Number.isInteger(verifiedPaidIrr) || verifiedPaidIrr < 0) return 0;
  return Math.min(orderTotalIrr, verifiedPaidIrr);
}

export function holdMayRelease(input: {
  status: string;
  paymentStatus: string;
  stockState: string;
  holdUntil: number | null;
  now: number;
}): boolean {
  return (
    input.status === "awaiting_payment" &&
    input.paymentStatus === "unpaid" &&
    input.stockState === "held" &&
    input.holdUntil !== null &&
    input.holdUntil <= input.now
  );
}

export type RefundSourceCandidate = {
  id: string;
  orderId: string;
  provider: string;
  status: string;
  currency: string;
  amountIrr: number | string;
};

export type RefundSourceChoice = { ok: true; paymentId: string } | { ok: false; reason: "none" | "ambiguous" | "amount" };

/**
 * Which payment a ledger refund points at (`refund_of_payment_id`).
 * Only a verified, non-ledger, IRR payment of the same order with a positive amount
 * qualifies; failed, pending, refund rows and other orders' payments never do.
 * No candidate -> "none" (caller must fail before mutating anything).
 * More than one -> "ambiguous" (a single link cannot represent it; never guess).
 * Refund larger than the source payment -> "amount".
 */
export function chooseRefundSourcePayment(orderId: string, refundIrr: number, rows: RefundSourceCandidate[]): RefundSourceChoice {
  const eligible = rows.filter(
    (row) =>
      row.orderId === orderId &&
      row.status === "verified" &&
      row.provider !== "ledger" &&
      row.currency === "IRR" &&
      Number(row.amountIrr) > 0,
  );
  if (eligible.length === 0) return { ok: false, reason: "none" };
  if (eligible.length > 1) return { ok: false, reason: "ambiguous" };
  if (refundIrr > Number(eligible[0].amountIrr)) return { ok: false, reason: "amount" };
  return { ok: true, paymentId: eligible[0].id };
}
