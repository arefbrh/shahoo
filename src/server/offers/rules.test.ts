import assert from "node:assert/strict";
import test from "node:test";
import { canCancelUnpaid, parseCouponDraft, parseShippingDraft } from "../../lib/offer-rules.ts";

test("a coupon is either a percent or a toman amount", () => {
  const percent = parseCouponDraft({
    code: "spring10",
    description: "بهار",
    mode: "percent",
    percent: 10,
    amountToman: null,
    minSubtotalToman: 0,
    usageLimit: null,
    startsOn: "2026-03-01",
    endsOn: "2026-03-31",
    isActive: true,
  });
  assert.equal(percent.ok, true);
  if (percent.ok) {
    assert.equal(percent.value.code, "SPRING10");
    assert.equal(percent.value.percentOff, 10);
    assert.equal(percent.value.amountOffIrr, null);
    assert.equal(percent.value.minSubtotalIrr, 0);
  }
  assert.equal(
    parseCouponDraft({
      code: "NO",
      description: "",
      mode: "percent",
      percent: 0,
      amountToman: null,
      minSubtotalToman: 0,
      usageLimit: null,
      startsOn: "",
      endsOn: "",
      isActive: true,
    }).ok,
    false,
  );
  const amount = parseCouponDraft({
    code: "OFF-50",
    description: "",
    mode: "amount",
    percent: null,
    amountToman: 50_000,
    minSubtotalToman: 200_000,
    usageLimit: 20,
    startsOn: "",
    endsOn: "2026-01-01",
    isActive: false,
  });
  assert.equal(amount.ok, true);
  if (amount.ok) assert.equal(amount.value.amountOffIrr, 500_000);
});

test("shipping stays manual and priced in whole toman", () => {
  const row = parseShippingDraft({
    key: "City-Post",
    title: "پست شهری",
    description: "هماهنگی دستی",
    priceToman: 90_000,
    freeOverToman: 1_500_000,
    sortOrder: 4,
    isActive: true,
  });
  assert.equal(row.ok, true);
  if (row.ok) {
    assert.equal(row.value.key, "city-post");
    assert.equal(row.value.priceIrr, 900_000);
    assert.equal(row.value.freeOverIrr, 15_000_000);
  }
  assert.equal(
    parseShippingDraft({
      key: "پست",
      title: "پست",
      description: "",
      priceToman: 1,
      freeOverToman: null,
      sortOrder: 1,
      isActive: true,
    }).ok,
    false,
  );
});

test("only an unpaid hold can be cancelled", () => {
  assert.equal(canCancelUnpaid("awaiting_payment"), true);
  assert.equal(canCancelUnpaid("expired"), false);
  assert.equal(canCancelUnpaid("paid"), false);
  assert.equal(canCancelUnpaid("cancelled"), false);
});
