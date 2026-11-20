import assert from "node:assert/strict";
import test from "node:test";
import { tomanToIrr } from "./money.ts";
import { isUnapprovedSeedShipping } from "./public-shipping.ts";

test("invented baseline shipping prices are not publishable", () => {
  assert.equal(
    isUnapprovedSeedShipping({
      id: "ship-post",
      key: "post",
      priceIrr: tomanToIrr(85_000),
      freeOverIrr: tomanToIrr(1_500_000),
    }),
    true,
  );
  assert.equal(
    isUnapprovedSeedShipping({
      key: "tipax",
      priceIrr: tomanToIrr(120_000),
      freeOverIrr: tomanToIrr(2_500_000),
    }),
    true,
  );
  assert.equal(isUnapprovedSeedShipping({ id: "ship-manual", key: "manual", priceIrr: 0, freeOverIrr: null }), true);
  assert.equal(
    isUnapprovedSeedShipping({
      id: "ship-post",
      key: "post",
      priceIrr: tomanToIrr(90_000),
      freeOverIrr: null,
    }),
    false,
  );
});
