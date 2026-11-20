import assert from "node:assert/strict";
import test from "node:test";
import { cartSetDecision } from "./cart-concurrency.ts";

test("a set applies only to the line quantity the customer saw", () => {
  assert.equal(cartSetDecision(2, 2), "apply");
  assert.equal(cartSetDecision(4, 2), "conflict");
  assert.equal(cartSetDecision(0, 2), "conflict");
});

test("even an already-equal target is a conflict when the observed quantity changed", () => {
  // It is impossible to distinguish an earlier successful retry from a concurrent writer.
  assert.equal(cartSetDecision(3, 2), "conflict");
  assert.equal(cartSetDecision(0, 2), "conflict");
});

test("legacy callers without an expectation keep existing behavior", () => {
  assert.equal(cartSetDecision(2), "apply");
  assert.equal(cartSetDecision(0), "apply");
});
