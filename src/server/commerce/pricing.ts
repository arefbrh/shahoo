import { hasUnsafeText } from "../../lib/text-safety.ts";

export const MAX_LINE_QTY = 20;
export const STOCK_HOLD_MS = 24 * 60 * 60 * 1000;

const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

import { IRAN_PROVINCES } from "../../lib/iran-provinces.ts";

export { IRAN_PROVINCES };

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "در انتظار پرداخت",
  pending_payment: "در انتظار پرداخت",
  paid: "پرداخت تأیید شده",
  processing: "در حال آماده‌سازی",
  ready_to_ship: "آماده ارسال",
  shipped: "تحویل شرکت حمل",
  handed_to_carrier: "تحویل شرکت حمل",
  delivered: "تحویل شده",
  cancelled: "لغو شده",
  returned: "مرجوع شده",
  refunded: "بازپرداخت ثبت شد",
  refund_recorded: "بازپرداخت ثبت شد",
  partially_refunded: "بازپرداخت جزئی ثبت شد",
  partial_refund_recorded: "بازپرداخت جزئی ثبت شد",
  expired: "مهلت موجودی تمام شد",
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "وضعیت نامشخص";
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "پرداخت نشده",
  pending: "در انتظار پرداخت",
  pending_payment: "در انتظار پرداخت",
  verified: "پرداخت تأیید شده",
  paid: "پرداخت تأیید شده",
  failed: "پرداخت ناموفق",
  expired: "مهلت پرداخت تمام شد",
  refund_recorded: "بازپرداخت ثبت شده",
  partial_refund_recorded: "بازپرداخت جزئی ثبت شده",
  refunded: "بازپرداخت ثبت شده",
  partially_refunded: "بازپرداخت جزئی ثبت شده",
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? "وضعیت پرداخت نامشخص";
}

export function clampLineQuantity(requested: number, sellableQty: number): number {
  if (!Number.isFinite(requested)) return 0;
  const qty = Math.floor(requested);
  if (qty < 1) return 0;
  return Math.min(MAX_LINE_QTY, qty, Math.max(0, Math.floor(sellableQty)));
}

export type CouponRule = {
  isActive: boolean;
  percentOff: number | null;
  amountOffIrr: number | null;
  minSubtotalIrr: number;
  startsAt: number | null;
  endsAt: number | null;
  usageLimit: number | null;
  usedCount: number;
};

export function evaluateCoupon(
  subtotalIrr: number,
  coupon: CouponRule,
  now: number,
): { ok: true; discountIrr: number } | { ok: false; message: string } {
  if (!coupon.isActive) return { ok: false, message: "این کد فعال نیست." };
  if (coupon.startsAt !== null && coupon.startsAt > now) return { ok: false, message: "این کد هنوز شروع نشده است." };
  if (coupon.endsAt !== null && coupon.endsAt < now) return { ok: false, message: "مهلت این کد تمام شده است." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: "ظرفیت این کد تمام شده است." };
  }
  if (subtotalIrr < coupon.minSubtotalIrr) return { ok: false, message: "مبلغ سبد به حداقل این کد نرسیده است." };
  let discount = 0;
  if (coupon.percentOff && coupon.percentOff > 0) {
    const percent = Math.min(100, Math.floor(coupon.percentOff));
    discount = Math.floor((subtotalIrr * percent) / 100);
  } else if (coupon.amountOffIrr && coupon.amountOffIrr > 0) {
    discount = coupon.amountOffIrr;
  }
  discount = Math.min(Math.max(0, subtotalIrr), Math.max(0, discount));
  return { ok: true, discountIrr: discount };
}

export function shippingCharge(
  method: { priceIrr: number; freeOverIrr: number | null },
  merchandiseIrr: number,
): number {
  if (method.freeOverIrr !== null && merchandiseIrr >= method.freeOverIrr) return 0;
  return Math.max(0, Math.floor(method.priceIrr));
}

export function orderTotal(subtotalIrr: number, discountIrr: number, shippingIrr: number): number {
  return Math.max(0, subtotalIrr - discountIrr) + Math.max(0, shippingIrr);
}

export function holdUntil(now: number): number {
  return now + STOCK_HOLD_MS;
}

export function holdIsDue(until: number | null, now: number): boolean {
  return until !== null && until <= now;
}

export function replayDecision(existingBuyer: string, callerBuyer: string): "replay" | "reject" {
  if (!existingBuyer || existingBuyer !== callerBuyer) return "reject";
  return "replay";
}

export function normalizeCouponCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  if (!code) return "";
  if (!/^[A-Z0-9-]+$/.test(code) || code.length > 40) return null;
  if (code.length < 3) return "";
  return code;
}

export function normalizePostalCode(input: string): string | null {
  let digits = "";
  for (const char of input.trim()) {
    const persian = PERSIAN.indexOf(char);
    const arabic = ARABIC.indexOf(char);
    if (persian >= 0) digits += String(persian);
    else if (arabic >= 0) digits += String(arabic);
    else if (char >= "0" && char <= "9") digits += char;
    else if (char === " " || char === "-") continue;
    else return null;
  }
  return /^\d{10}$/.test(digits) ? digits : null;
}

export function cleanText(value: string, min: number, max: number): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) return null;
  if (hasUnsafeText(text)) return null;
  return text;
}

export function isIranProvince(value: string): boolean {
  return (IRAN_PROVINCES as readonly string[]).includes(value);
}
