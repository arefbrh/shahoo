import assert from "node:assert/strict";
import test from "node:test";
import { carouselImageIndices, carouselIndex, carouselIndicatorTargets } from "./home-carousel.ts";

test("only the active and next banner images are eligible to load", () => {
  assert.deepEqual(carouselImageIndices(0, 0), []);
  assert.deepEqual(carouselImageIndices(1, 0), [0]);
  assert.deepEqual(carouselImageIndices(2, 1), [1, 0]);
  assert.deepEqual(carouselImageIndices(8, 7), [7, 0]);
  assert.deepEqual(carouselImageIndices(8, -1), [7, 0]);
  for (let count = 1; count <= 8; count += 1) {
    for (let index = 0; index < count; index += 1) {
      const eligible = carouselImageIndices(count, index);
      assert.equal(eligible.length, Math.min(count, 2));
      assert.deepEqual(eligible, [...new Set(eligible)]);
      assert.equal(eligible[0], index);
      if (count > 1) assert.equal(eligible[1], (index + 1) % count);
    }
  }
});

test("three indicators and wrapping navigation retain access to every banner", () => {
  assert.deepEqual(carouselIndicatorTargets(0, 0), [null, null, null]);
  for (let count = 1; count <= 8; count += 1) {
    for (let index = 0; index < count; index += 1) {
      const slots = carouselIndicatorTargets(count, index);
      assert.equal(slots.length, 3);
      assert.ok(slots.includes(index));
      assert.equal(carouselIndex(index + 1, count), (index + 1) % count);
      assert.equal(carouselIndex(index - 1, count), (index + count - 1) % count);
    }
  }
});
