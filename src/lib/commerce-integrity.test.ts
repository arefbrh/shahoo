import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutIdempotencyKey,
  chooseRefundSourcePayment,
  combinedCartQuantity,
  holdMayRelease,
  isLineSellable,
  paymentTransition,
  refundCeiling,
} from "./commerce-integrity.ts";

test("guest merge sums once and a repeated local adopt keeps the larger quantity", () => {
  assert.equal(combinedCartQuantity(2, 3, 10, "sum"), 5);
  assert.equal(combinedCartQuantity(2, 3, 4, "sum"), 4);
  assert.equal(combinedCartQuantity(2, 2, 10, "max"), 2);
  assert.equal(combinedCartQuantity(2, 4, 10, "max"), 4);
  assert.equal(combinedCartQuantity(4, 3, 10, "max"), 4);
  assert.equal(combinedCartQuantity(1, 1, 0, "sum"), 0);
});

test("checkout idempotency keys stay scoped to a safe token", () => {
  assert.equal(checkoutIdempotencyKey("key-1"), "key-1");
  assert.equal(checkoutIdempotencyKey("  "), null);
  assert.equal(checkoutIdempotencyKey("bad key"), null);
  assert.equal(checkoutIdempotencyKey("x".repeat(81)), null);
});

test("payment transitions do not let a success become a failure", () => {
  assert.equal(paymentTransition(null, "verify_ok").ok, true);
  assert.equal(paymentTransition("verified", "verify_ok").ok && paymentTransition("verified", "verify_ok").ok, true);
  assert.equal(paymentTransition("verified", "verify_fail").ok, false);
  assert.equal(paymentTransition("failed", "verify_ok").ok, false);
  assert.equal(paymentTransition("failed", "verify_fail").ok, true);
  assert.equal(paymentTransition("expired", "verify_ok").ok, false);
});

test("refunds cannot exceed the verified payment when one exists", () => {
  assert.equal(refundCeiling(1000, null), 1000);
  assert.equal(refundCeiling(1000, 600), 600);
  assert.equal(refundCeiling(1000, 1500), 1000);
});

test("a paid or already released hold is not released again", () => {
  const now = 1_000_000;
  assert.equal(
    holdMayRelease({ status: "awaiting_payment", paymentStatus: "unpaid", stockState: "held", holdUntil: now - 1, now }),
    true,
  );
  assert.equal(
    holdMayRelease({ status: "paid", paymentStatus: "verified", stockState: "captured", holdUntil: now - 1, now }),
    false,
  );
  assert.equal(
    holdMayRelease({ status: "expired", paymentStatus: "unpaid", stockState: "released", holdUntil: now - 1, now }),
    false,
  );
});

test("isLineSellable: the shared rule used by checkout and recovery", () => {
  const ok = { productStatus: "published", variantStatus: "active", productDeletedAt: null, categoryActive: true, categoryDeletedAt: null };
  assert.equal(isLineSellable(ok), true);
  assert.equal(isLineSellable({ ...ok, categoryActive: false }), false);
  assert.equal(isLineSellable({ ...ok, categoryActive: null }), false, "missing category row");
  assert.equal(isLineSellable({ ...ok, categoryDeletedAt: new Date() }), false);
  assert.equal(isLineSellable({ ...ok, productStatus: "draft" }), false);
  assert.equal(isLineSellable({ ...ok, productDeletedAt: new Date() }), false);
  assert.equal(isLineSellable({ ...ok, variantStatus: "archived" }), false);
  assert.equal(isLineSellable({ ...ok, variantStatus: null }), false, "missing variant");
  assert.equal(isLineSellable({ ...ok, productFound: false }), false, "missing product");
});

const cand = (over: Partial<Parameters<typeof chooseRefundSourcePayment>[2][number]>) => ({
  id: "p", orderId: "o1", provider: "mock", status: "verified", currency: "IRR", amountIrr: 1000, ...over,
});

test("refund source: only a verified, same-order, non-ledger IRR payment qualifies", () => {
  assert.deepEqual(chooseRefundSourcePayment("o1", 1000, [cand({ id: "ok" })]), { ok: true, paymentId: "ok" });
  const rows = [cand({ id: "f", status: "failed" }), cand({ id: "p2", status: "pending" }), cand({ id: "ok" }), cand({ id: "x", orderId: "o2" })];
  assert.deepEqual(chooseRefundSourcePayment("o1", 1000, rows), { ok: true, paymentId: "ok" });
  assert.deepEqual(chooseRefundSourcePayment("o1", 1000, [cand({ status: "failed" }), cand({ status: "pending" })]), { ok: false, reason: "none" });
  assert.deepEqual(chooseRefundSourcePayment("o1", 1000, [cand({ provider: "ledger" })]), { ok: false, reason: "none" });
  assert.deepEqual(chooseRefundSourcePayment("o1", 1000, [cand({ currency: "USD" })]), { ok: false, reason: "none" });
  assert.deepEqual(chooseRefundSourcePayment("o1", 1000, [cand({ orderId: "o2" })]), { ok: false, reason: "none" });
  assert.deepEqual(chooseRefundSourcePayment("o1", 1000, [cand({ amountIrr: 0 })]), { ok: false, reason: "none" });
  assert.deepEqual(chooseRefundSourcePayment("o1", 1000, [cand({ id: "a" }), cand({ id: "b" })]), { ok: false, reason: "ambiguous" });
  assert.deepEqual(chooseRefundSourcePayment("o1", 1500, [cand({})]), { ok: false, reason: "amount" });
  assert.deepEqual(chooseRefundSourcePayment("o1", 0, []), { ok: false, reason: "none" });
});
