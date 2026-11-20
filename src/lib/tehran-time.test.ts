import assert from "node:assert/strict";
import test from "node:test";
import { parseCouponDraft } from "./offer-rules.ts";
import { tehranDayEnd, tehranDayKey, tehranDayStart } from "./tehran-time.ts";
import { evaluateCoupon } from "../server/commerce/pricing.ts";

test("Tehran coupon day starts at 00:00 and ends at 23:59:59", () => {
  const start = tehranDayStart("2026-03-21");
  const end = tehranDayEnd("2026-03-21");
  assert.ok(start && end);
  assert.equal(start.toISOString(), "2026-03-20T20:30:00.000Z");
  assert.equal(end.toISOString(), "2026-03-21T20:29:59.000Z");
  assert.equal(tehranDayKey(start), "2026-03-21");
  assert.equal(tehranDayKey(new Date(start.getTime() - 1000)), "2026-03-20");
  assert.equal(tehranDayKey(new Date(end.getTime() + 1000)), "2026-03-22");
  assert.equal(tehranDayStart("2026-02-31"), null);
  assert.equal(tehranDayStart("21-03-2026"), null);
});

test("UTC date text is not the Tehran display date", () => {
  const instant = new Date("2026-03-20T21:00:00.000Z");
  assert.equal(instant.toISOString().slice(0, 10), "2026-03-20");
  assert.equal(tehranDayKey(instant), "2026-03-21");
});

test("same-day coupon covers the Tehran day and not the second after", () => {
  const parsed = parseCouponDraft({
    code: "NOW-10",
    description: "",
    mode: "percent",
    percent: 10,
    amountToman: null,
    minSubtotalToman: 0,
    usageLimit: null,
    startsOn: "2026-03-21",
    endsOn: "2026-03-21",
    isActive: true,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok || !parsed.value.startsAt || !parsed.value.endsAt) return;
  const rule = {
    isActive: true,
    percentOff: 10,
    amountOffIrr: null,
    minSubtotalIrr: 0,
    startsAt: parsed.value.startsAt.getTime(),
    endsAt: parsed.value.endsAt.getTime(),
    usageLimit: null,
    usedCount: 0,
  };
  assert.equal(evaluateCoupon(1000, rule, parsed.value.startsAt.getTime()).ok, true);
  assert.equal(evaluateCoupon(1000, rule, parsed.value.endsAt.getTime()).ok, true);
  assert.equal(evaluateCoupon(1000, rule, parsed.value.startsAt.getTime() - 1000).ok, false);
  assert.equal(evaluateCoupon(1000, rule, parsed.value.endsAt.getTime() + 1000).ok, false);
});
