import assert from "node:assert/strict";
import test from "node:test";
import { createCartIntentStore, parseLegacyCart, sameCartIntent } from "./cart-intents.ts";

const retry = { variantId: "v1", quantity: 3, name: "کالا", expectedCartId: "cart-a", expectedQuantity: 2, text: "نامشخص" };
const RETRY_KEY = "shahoo-cart-retry-v1";
const ADD_KEY = "shahoo-cart-add-pending-v1";

function memoryStorage() {
  const map = new Map<string, string>();
  let failRead = false;
  let failWrites = false;
  let failWriteKey = "";
  let failRemoveKey = "";
  return {
    map,
    failRead: (value: boolean) => { failRead = value; },
    failWrites: (value: boolean) => { failWrites = value; },
    failWrite: (key: string) => { failWriteKey = key; },
    failRemove: (key: string) => { failRemoveKey = key; },
    getItem(key: string) { if (failRead) throw new Error("denied"); return map.get(key) ?? null; },
    setItem(key: string, value: string) { if (failWrites || key === failWriteKey) throw new Error("denied"); map.set(key, value); },
    removeItem(key: string) { if (key === failRemoveKey) throw new Error("denied"); map.delete(key); },
  };
}

test("absolute intent is durable across instances and cannot be replaced by another cart", () => {
  const storage = memoryStorage();
  const first = createCartIntentStore(() => storage, () => {});
  assert.equal(first.saveRetry(retry), true);
  const reload = createCartIntentStore(() => storage, () => {});
  assert.deepEqual(reload.read().retry, retry);
  assert.equal(reload.saveRetry({ ...retry, expectedCartId: "cart-b" }), false);
  assert.equal(reload.saveRetry({ ...retry, quantity: 4 }), false);
  assert.equal(reload.startAdd(), false);
  assert.deepEqual(reload.read().retry, retry);
  assert.equal(reload.saveRetry({ ...retry, text: "خطا" }), true);
  assert.equal(reload.read().retry?.text, "خطا");
  assert.equal(reload.clearRetry(), true);
  assert.equal(reload.read().retry, null);
});

test("an add marker survives reload, contains no product details, and blocks another add", () => {
  const storage = memoryStorage();
  const first = createCartIntentStore(() => storage, () => {});
  assert.equal(first.startAdd(), true);
  assert.deepEqual(JSON.parse(storage.map.get(ADD_KEY) ?? "null"), { version: 1 });
  const reload = createCartIntentStore(() => storage, () => {});
  assert.equal(reload.read().addPending, true);
  assert.equal(reload.startAdd(), false);
  assert.equal(reload.saveRetry(retry), false);
  assert.equal(reload.clearAdd(), true); // caller must first confirm success or explicit fresh-cart review
  assert.equal(reload.startAdd(), true);
});

test("unavailable reads and quota-blocked writes fail closed and recover after storage is restored", () => {
  const storage = memoryStorage();
  const store = createCartIntentStore(() => storage, () => {});
  storage.failRead(true);
  assert.equal(store.read().storageAvailable, false);
  assert.equal(store.saveRetry(retry), false);
  assert.equal(store.startAdd(), false);
  storage.failRead(false);
  storage.failWrites(true);
  assert.equal(store.read().storageAvailable, false);
  assert.equal(store.startAdd(), false);
  assert.equal(storage.map.has(ADD_KEY), false);
  storage.failWrites(false);
  assert.equal(store.read().storageAvailable, true);
  assert.equal(store.saveRetry(retry), true);
});

test("failed removal leaves the existing marker for recovery", () => {
  const storage = memoryStorage();
  const store = createCartIntentStore(() => storage, () => {});
  assert.equal(store.saveRetry(retry), true);
  storage.failRemove(RETRY_KEY);
  assert.equal(store.clearRetry(), false);
  assert.deepEqual(store.read().retry, retry);
  storage.failRemove("");
  const restored = createCartIntentStore(() => storage, () => {});
  assert.equal(restored.clearRetry(), true);
  assert.equal(restored.startAdd(), true);
  storage.failRemove(ADD_KEY);
  assert.equal(restored.clearAdd(), false);
  assert.equal(restored.read().addPending, true);
});

test("a failed real write remains visibly unavailable even if the storage probe works", () => {
  const storage = memoryStorage();
  const store = createCartIntentStore(() => storage, () => {});
  assert.equal(store.read().storageAvailable, true);
  storage.failWrite(RETRY_KEY);
  assert.equal(store.saveRetry(retry), false);
  assert.equal(store.read().storageAvailable, false);
  assert.equal(store.startAdd(), false);
  assert.equal(storage.map.has(RETRY_KEY), false);
  storage.failWrite("");
  const reload = createCartIntentStore(() => storage, () => {});
  assert.equal(reload.read().storageAvailable, true);
});

test("malformed intent records remain blocked instead of being overwritten", () => {
  const storage = memoryStorage();
  storage.map.set(RETRY_KEY, "{bad");
  const store = createCartIntentStore(() => storage, () => {});
  assert.equal(store.read().retryInvalid, true);
  assert.equal(store.saveRetry(retry), false);
  assert.equal(store.startAdd(), false);
  assert.equal(storage.map.get(RETRY_KEY), "{bad");
  assert.equal(store.clearRetry(), true);
  storage.map.set(ADD_KEY, "not-json");
  assert.equal(store.read().addPending, true);
  assert.equal(store.startAdd(), false);
});

test("intent identity includes cart, variant, requested and expected quantity", () => {
  assert.equal(sameCartIntent(retry, { ...retry, text: "updated" }), true);
  for (const changed of [{ expectedCartId: "other" }, { variantId: "other" }, { quantity: 0 }, { expectedQuantity: 0 }]) {
    assert.equal(sameCartIntent(retry, { ...retry, ...changed }), false);
  }
});

test("legacy parsing accepts valid data and rejects malformed or partially lossy migration", () => {
  assert.deepEqual(parseLegacyCart(JSON.stringify({ state: { items: [{ variantId: "v", quantity: 2 }] } })), [{ variantId: "v", quantity: 2 }]);
  for (const raw of ["{", "null", "{}", JSON.stringify({ state: { items: [null] } }), JSON.stringify({ state: { items: [{ variantId: "v", quantity: 2.5 }] } }), JSON.stringify({ state: { items: Array(31).fill({ variantId: "v", quantity: 1 }) } })]) {
    assert.throws(() => parseLegacyCart(raw));
  }
});
