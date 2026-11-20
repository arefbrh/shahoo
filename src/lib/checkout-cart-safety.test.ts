import assert from "node:assert/strict";
import test from "node:test";
import { checkoutCartExpectation, checkoutIdentityReadDecision, checkoutIntentsBlocked, checkoutOwnerExpectationMatches, checkoutReadIsCurrent, sameCheckoutCart } from "./checkout-cart-safety.ts";

const a = { variantId: "a", quantity: 2, unitPriceIrr: 1000 };
const b = { variantId: "b", quantity: 1, unitPriceIrr: 3000 };
const reviewed = { cartId: "cart-one", lines: [a, b] };

test("the comparison is order independent but checks cart identity and every line", () => {
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-one", lines: [b, a] }), true);
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-two", lines: [a, b] }), false);
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-one", lines: [a] }), false);
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-one", lines: [a, b, { ...b, variantId: "c" }] }), false);
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-one", lines: [a, { ...b, quantity: 2 }] }), false);
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-one", lines: [a, { ...b, unitPriceIrr: 2999 }] }), false);
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-one", lines: [a, { ...b, variantId: "c" }] }), false);
});

test("duplicate variants and equal-subtotal changes never compare equal", () => {
  assert.equal(sameCheckoutCart({ cartId: "x", lines: [a, a] }, { cartId: "x", lines: [a, a] }), false);
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-one", lines: [a, a] }), false);
  assert.equal(sameCheckoutCart(reviewed, { cartId: "cart-one", lines: [{ ...a, unitPriceIrr: 500 }, { ...b, unitPriceIrr: 4000 }] }), false);
});

test("only nonempty identified carts produce checkout expectations", () => {
  assert.deepEqual(checkoutCartExpectation(reviewed), reviewed);
  assert.equal(checkoutCartExpectation({ lines: [a] }), null);
  assert.equal(checkoutCartExpectation({ cartId: "cart-one", lines: [] }), null);
  assert.equal(sameCheckoutCart({ lines: [] }, { lines: [] }), true);
  assert.equal(sameCheckoutCart({ lines: [] }, { cartId: "cart-one", lines: [] }), false);
});

test("events, writes and retries invalidate an asynchronous read", () => {
  const started = { revision: 3, generation: 5 };
  const now = { ...started, pending: false, retry: false };
  assert.equal(checkoutReadIsCurrent(started, now), true);
  assert.equal(checkoutReadIsCurrent(started, { ...now, revision: 4 }), false);
  assert.equal(checkoutReadIsCurrent(started, { ...now, generation: 6 }), false);
  assert.equal(checkoutReadIsCurrent(started, { ...now, pending: true }), false);
  assert.equal(checkoutReadIsCurrent(started, { ...now, retry: true }), false);
});

test("unacknowledged adds, retries, malformed intents, and inaccessible storage all block checkout", () => {
  const clear = { storageAvailable: true, retry: null, retryInvalid: false, addPending: false };
  assert.equal(checkoutIntentsBlocked(clear), false);
  assert.equal(checkoutIntentsBlocked({ ...clear, storageAvailable: false }), true);
  assert.equal(checkoutIntentsBlocked({ ...clear, retry: { variantId: "a" } }), true);
  assert.equal(checkoutIntentsBlocked({ ...clear, retryInvalid: true }), true);
  assert.equal(checkoutIntentsBlocked({ ...clear, addPending: true }), true);
});

test("checkout context cannot cross an account change, background interval, or intervening cart event", () => {
  const started = { revision: 3, generation: 5 };
  const current = { ...started, pending: false, retry: false, focused: true, visible: true };
  assert.equal(checkoutIdentityReadDecision("+989120000000", "+989120000000", started, current), "current");
  assert.equal(checkoutIdentityReadDecision("+989120000000", "+989130000000", started, current), "owner_changed");
  assert.equal(checkoutIdentityReadDecision(null, "+989130000000", started, current), "owner_changed");
  assert.equal(checkoutIdentityReadDecision("+989120000000", "+989120000000", started, { ...current, focused: false }), "stale");
  assert.equal(checkoutIdentityReadDecision("+989120000000", "+989120000000", started, { ...current, revision: 4 }), "stale");
  assert.equal(checkoutOwnerExpectationMatches(undefined, "+989130000000"), true);
  assert.equal(checkoutOwnerExpectationMatches(null, null), true);
  assert.equal(checkoutOwnerExpectationMatches(null, "+989130000000"), false);
});
