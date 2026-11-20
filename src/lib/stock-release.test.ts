import assert from "node:assert/strict";
import test from "node:test";
import { couponRestoreId, releaseDecision, sellableStock } from "./stock-release.ts";

test("reservation release aborts instead of clamping", () => {
  assert.deepEqual(releaseDecision(4, 2), { ok: true, nextReserved: 2 });
  const short = releaseDecision(1, 2);
  assert.equal(short.ok, false);
  if (!short.ok) assert.equal(short.reserved, 1);
  assert.equal(sellableStock(10, 4), 6);
});

test("coupon restore follows the stored id, not a reused code", () => {
  assert.equal(couponRestoreId("coupon-a"), "coupon-a");
  assert.equal(couponRestoreId(null), null);
  assert.equal(couponRestoreId("  "), null);
});
