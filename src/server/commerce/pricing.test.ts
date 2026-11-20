import assert from "node:assert/strict";
import test from "node:test";
import {
  clampLineQuantity,
  cleanText,
  evaluateCoupon,
  holdIsDue,
  holdUntil,
  isIranProvince,
  normalizeCouponCode,
  normalizePostalCode,
  orderStatusLabel,
  orderTotal,
  paymentStatusLabel,
  replayDecision,
  shippingCharge,
  STOCK_HOLD_MS,
} from "./pricing.ts";

const openCoupon = {
  isActive: true,
  percentOff: 10,
  amountOffIrr: null,
  minSubtotalIrr: 0,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usedCount: 0,
};

test("percent coupon uses integer rials and never exceeds the subtotal", () => {
  const result = evaluateCoupon(1_000, openCoupon, 0);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.discountIrr, 100);
  const capped = evaluateCoupon(50, { ...openCoupon, percentOff: null, amountOffIrr: 500 }, 0);
  assert.equal(capped.ok, true);
  if (capped.ok) assert.equal(capped.discountIrr, 50);
});

test("coupon rejects inactive, early, expired, exhausted, and under-minimum codes", () => {
  assert.equal(evaluateCoupon(100, { ...openCoupon, isActive: false }, 0).ok, false);
  assert.equal(evaluateCoupon(100, { ...openCoupon, startsAt: 50 }, 10).ok, false);
  assert.equal(evaluateCoupon(100, { ...openCoupon, endsAt: 10 }, 10).ok, true);
  assert.equal(evaluateCoupon(100, { ...openCoupon, endsAt: 10 }, 11).ok, false);
  assert.equal(evaluateCoupon(100, { ...openCoupon, usageLimit: 1, usedCount: 1 }, 0).ok, false);
  assert.equal(evaluateCoupon(100, { ...openCoupon, minSubtotalIrr: 200 }, 0).ok, false);
});

test("shipping becomes free only at the threshold and totals stay non-negative", () => {
  assert.equal(shippingCharge({ priceIrr: 850_000, freeOverIrr: 15_000_000 }, 14_999_999), 850_000);
  assert.equal(shippingCharge({ priceIrr: 850_000, freeOverIrr: 15_000_000 }, 15_000_000), 0);
  assert.equal(shippingCharge({ priceIrr: 0, freeOverIrr: null }, 100), 0);
  assert.equal(orderTotal(1_000, 400, 50), 650);
  assert.equal(orderTotal(100, 500, 0), 0);
});

test("line quantity is capped by stock and the shop limit", () => {
  assert.equal(clampLineQuantity(3, 10), 3);
  assert.equal(clampLineQuantity(50, 100), 20);
  assert.equal(clampLineQuantity(5, 2), 2);
  assert.equal(clampLineQuantity(0, 5), 0);
  assert.equal(clampLineQuantity(1.9, 5), 1);
});

test("address helpers accept Iranian postal codes and provinces only", () => {
  assert.equal(normalizePostalCode("۱۲۳۴۵-۶۷۸۹۰"), "1234567890");
  assert.equal(normalizePostalCode("12345"), null);
  assert.equal(normalizeCouponCode(" shahoo10 "), "SHAHOO10");
  assert.equal(normalizeCouponCode("کد"), null);
  assert.equal(cleanText("  خیابان  ولیعصر  ", 2, 40), "خیابان ولیعصر");
  assert.equal(cleanText("<b>", 1, 10), null);
  assert.equal(isIranProvince("تهران"), true);
  assert.equal(isIranProvince("تهران "), false);
});

test("stock hold and checkout replay stay bound to the same buyer", () => {
  assert.equal(holdUntil(1_000) - 1_000, STOCK_HOLD_MS);
  assert.equal(holdIsDue(1_000, 1_000), true);
  assert.equal(holdIsDue(1_001, 1_000), false);
  assert.equal(holdIsDue(null, 1_000), false);
  assert.equal(replayDecision("c:1", "c:1"), "replay");
  assert.equal(replayDecision("c:1", "g:1"), "reject");
  assert.equal(replayDecision("", "c:1"), "reject");
});

test("customer order and payment statuses map to Persian labels, not raw values", () => {
  const statuses = ["pending_payment", "paid", "processing", "ready_to_ship", "handed_to_carrier", "delivered", "cancelled", "returned", "refund_recorded", "partial_refund_recorded", "expired"];
  for (const status of statuses) {
    assert.notEqual(orderStatusLabel(status), "وضعیت نامشخص", status);
    assert.notEqual(orderStatusLabel(status), status, status);
  }
  for (const status of ["unpaid", "verified", "failed", "expired", "refund_recorded", "partial_refund_recorded"]) {
    assert.notEqual(paymentStatusLabel(status), "وضعیت پرداخت نامشخص", status);
    assert.notEqual(paymentStatusLabel(status), status, status);
  }
});
