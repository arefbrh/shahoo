import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStockDelta,
  canPublish,
  chooseDefaultIndex,
  chooseSellableDefault,
  normalizeSku,
  normalizeSlug,
  parseImageUrl,
  passesMaxPrice,
  parseToman,
  parseWhole,
} from "./rules.ts";

test("slugs and skus stay ascii and bounded", () => {
  assert.equal(normalizeSlug(" Sesame-Oil "), "sesame-oil");
  assert.equal(normalizeSlug("روغن"), null);
  assert.equal(normalizeSlug("a"), null);
  assert.equal(normalizeSku(" sh-ses-250 "), "SH-SES-250");
  assert.equal(normalizeSku("قیمت"), null);
});

test("toman prices are integers and image urls are https only", () => {
  const price = parseToman(1990000);
  assert.equal(price.ok, true);
  if (price.ok) assert.equal(price.irr, 19900000);
  assert.equal(parseToman(1.5).ok, false);
  assert.equal(parseToman(-1).ok, false);
  assert.equal(parseImageUrl(""), "");
  assert.equal(parseImageUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
  assert.equal(parseImageUrl("http://cdn.example.com/a.png"), null);
  assert.equal(parseImageUrl("javascript:alert(1)"), null);
  assert.equal(parseImageUrl("https://user:pass@cdn.example.com/a.png"), null);
});

test("catalog price filter does not hide products when no maximum is set", () => {
  assert.equal(passesMaxPrice(7_000_000, null), true);
  assert.equal(passesMaxPrice(7_000_000, undefined), true);
  assert.equal(passesMaxPrice(7_000_000, 6_000_000), false);
  assert.equal(passesMaxPrice(6_000_000, 6_000_000), true);
});

test("stock cannot pass reserved units or go negative", () => {
  assert.deepEqual(applyStockDelta(18, 1, -2), { ok: true, next: 16 });
  assert.equal(applyStockDelta(18, 5, -14).ok, false);
  assert.equal(applyStockDelta(2, 0, -3).ok, false);
  assert.equal(applyStockDelta(2, 0, 0).ok, false);
  assert.equal(applyStockDelta(2, 0, 5001).ok, false);
});

test("publishing needs an active package and one default", () => {
  assert.equal(canPublish(0), false);
  assert.equal(canPublish(1), true);
  assert.equal(chooseDefaultIndex([false, true, false]), 1);
  assert.equal(chooseDefaultIndex([false, false]), 0);
  assert.equal(chooseSellableDefault([
    { isDefault: true, active: false },
    { isDefault: false, active: true },
  ]), 1);
  assert.equal(parseWhole("−۱۲"), -12);
  assert.equal(parseWhole("1,000"), 1000);
});
