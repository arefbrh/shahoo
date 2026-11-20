import { adoptLocalCartFn } from "@/server/commerce/api";
import { createCartWriteGate } from "@/lib/cart-ui-rules";
import { createCartIntentStore, parseLegacyCart } from "./cart-intents";
export type { CartRetry, CartIntentState } from "./cart-intents";
export { sameCartIntent } from "./cart-intents";

// These signals coordinate existing server cart views; they are not a second cart store.
const writeGate = createCartWriteGate();
const intents = createCartIntentStore(
  () => window.sessionStorage,
  () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("shahoo-cart-retry")); },
);
export const getCartIntents = intents.read;
export const setCartRetry = intents.saveRetry;
export const clearCartRetry = intents.clearRetry;
export const startCartAdd = intents.startAdd;
export const clearCartAdd = intents.clearAdd;
// Checkout's existing truthiness guard also fails closed for an uncertain add or unreadable storage.
export function getCartRetry() {
  const state = getCartIntents();
  return state.retry ?? (state.retryInvalid || state.addPending || !state.storageAvailable ? true : null);
}

export function cartRevision() { return writeGate.revision(); }
export function cartWritePending() { return writeGate.pending(); }
export function beginCartWrite(): (() => void) | null {
  const release = writeGate.begin();
  if (!release) return null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("shahoo-cart-write"));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("shahoo-cart-write"));
  };
}

export function notifyCart(count: number) {
  writeGate.invalidate();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("shahoo-cart", { detail: count }));
}

let adoptPromise: Promise<void> | null = null;
let bypassLegacy = false;

/** Explicitly skip legacy adoption for this page lifetime, without deleting the old data. */
export function bypassBrowserCart() { bypassLegacy = true; }

/** Moves a well-formed old browser cart into Postgres once, then forgets the local copy. */
export function adoptBrowserCartOnce(): Promise<void> {
  if (typeof window === "undefined" || bypassLegacy) return Promise.resolve();
  if (adoptPromise) return adoptPromise;
  const attempt = Promise.resolve().then(async () => {
    const raw = localStorage.getItem("shahoo-cart-v1");
    if (raw === null) return;
    const items = parseLegacyCart(raw);
    if (items.length) await adoptLocalCartFn({ data: { items } });
    localStorage.removeItem("shahoo-cart-v1");
  });
  adoptPromise = attempt.catch((error: unknown) => {
    // Retain the old cart and allow retry or an explicit non-destructive bypass.
    adoptPromise = null;
    throw error;
  });
  return adoptPromise;
}
