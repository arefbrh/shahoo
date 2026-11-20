import assert from "node:assert/strict";
import test from "node:test";
import { CART_UPDATE_FAILED, clampDraftQuantity, createCartWriteGate, createLatestGate } from "./cart-ui-rules.ts";

test("a stale response cannot overwrite a newer action", async () => {
  const gate = createLatestGate();
  let shown = "";
  const run = async (label: string, delayMs: number) => {
    const ticket = gate.next();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (gate.isLatest(ticket)) shown = label;
  };
  // The first request is slow, the second (newer) is fast: the slow one must not win.
  await Promise.all([run("old", 30), run("new", 5)]);
  assert.equal(shown, "new");
});

test("only the newest ticket is current", () => {
  const gate = createLatestGate();
  const first = gate.next();
  assert.equal(gate.isLatest(first), true);
  const second = gate.next();
  assert.equal(gate.isLatest(first), false);
  assert.equal(gate.isLatest(second), true);
});

test("cart page and drawer share a synchronous write guard", () => {
  const gate = createCartWriteGate();
  const before = gate.revision();
  const release = gate.begin();
  assert.ok(release);
  assert.equal(gate.pending(), true);
  assert.equal(gate.begin(), null);
  assert.notEqual(gate.revision(), before);
  release();
  assert.equal(gate.pending(), false);
  const after = gate.revision();
  release();
  assert.equal(gate.revision(), after);
  assert.ok(gate.begin());
});

test("a read revision is invalidated by an external event or an entire write", () => {
  const gate = createCartWriteGate();
  const readBeforeEvent = gate.revision();
  gate.invalidate();
  assert.notEqual(gate.revision(), readBeforeEvent);
  const readBeforeWrite = gate.revision();
  const release = gate.begin();
  assert.ok(release);
  release();
  assert.notEqual(gate.revision(), readBeforeWrite);
});

test("typed quantity is clamped locally, the server stays authoritative", () => {
  assert.equal(clampDraftQuantity("3", 10), 3);
  assert.equal(clampDraftQuantity("0", 10), 1);
  assert.equal(clampDraftQuantity("-4", 10), 1);
  assert.equal(clampDraftQuantity("", 10), 1);
  assert.equal(clampDraftQuantity("abc", 10), 1);
  assert.equal(clampDraftQuantity("2.9", 10), 2);
  assert.equal(clampDraftQuantity("99", 50), 20);
  assert.equal(clampDraftQuantity("9", 4), 4);
  assert.equal(clampDraftQuantity("5", 0), 1);
});

test("the failure message is Persian and does not expose technical text", () => {
  assert.match(CART_UPDATE_FAILED, /[؀-ۿ]/);
  assert.doesNotMatch(CART_UPDATE_FAILED, /error|exception|sql|stack|undefined/i);
});
