export type CartRetry = { variantId: string; quantity: number; name: string; expectedCartId: string; expectedQuantity: number; text: string };
export type CartIntentState = { retry: CartRetry | null; retryInvalid: boolean; addPending: boolean; storageAvailable: boolean };
export const CART_SET_UNCERTAIN = "نتیجهٔ تغییر سبد مشخص نشد و ممکن است ثبت شده باشد. سبد تازه را بررسی کنید.";

const RETRY_KEY = "shahoo-cart-retry-v1";
const ADD_KEY = "shahoo-cart-add-pending-v1";
const PROBE_KEY = "shahoo-cart-storage-probe-v1";

type IntentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function validRetry(value: unknown): value is CartRetry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartRetry>;
  return typeof item.variantId === "string" && item.variantId.length > 0 && item.variantId.length <= 80 &&
    typeof item.expectedCartId === "string" && item.expectedCartId.length > 0 && item.expectedCartId.length <= 80 &&
    typeof item.name === "string" && typeof item.text === "string" &&
    Number.isInteger(item.quantity) && (item.quantity as number) >= 0 && (item.quantity as number) <= 20 &&
    Number.isInteger(item.expectedQuantity) && (item.expectedQuantity as number) >= 0 && (item.expectedQuantity as number) <= 20;
}

export function sameCartIntent(a: CartRetry, b: CartRetry): boolean {
  return a.variantId === b.variantId && a.quantity === b.quantity && a.expectedCartId === b.expectedCartId && a.expectedQuantity === b.expectedQuantity;
}

/**
 * Tab-scoped intent metadata only, never cart contents or an alternate cart store.
 * Separate tabs have independent markers/gates. A cart-id + quantity check cannot detect
 * an ABA change, and an interrupted add may commit after a fresh read; neither is a
 * substitute for server-side versions/idempotency. Session storage may end with the tab.
 */
export function createCartIntentStore(storage: () => IntentStorage, changed: () => void) {
  let state: CartIntentState = { retry: null, retryInvalid: false, addPending: false, storageAvailable: false };
  let writeFailed = false;
  function read(): CartIntentState {
    try {
      const s = storage();
      const rawRetry = s.getItem(RETRY_KEY);
      const rawAdd = s.getItem(ADD_KEY);
      let retry: CartRetry | null = null;
      let retryInvalid = false;
      if (rawRetry !== null) {
        try {
          const parsed: unknown = JSON.parse(rawRetry);
          if (validRetry(parsed)) retry = parsed;
          else retryInvalid = true;
        } catch { retryInvalid = true; }
      }
      // Treat even a malformed add marker as unresolved; no product details are stored.
      state = { retry, retryInvalid, addPending: rawAdd !== null, storageAvailable: false };
      s.setItem(PROBE_KEY, "1");
      if (s.getItem(PROBE_KEY) !== "1") throw new Error("storage unavailable");
      s.removeItem(PROBE_KEY);
      state.storageAvailable = !writeFailed;
    } catch {
      state = { ...state, storageAvailable: false };
    }
    return { ...state };
  }
  function write(key: string, value: string | null): boolean {
    try {
      const s = storage();
      if (value === null) s.removeItem(key);
      else s.setItem(key, value);
      if (s.getItem(key) !== value) throw new Error("storage unavailable");
      const available = read().storageAvailable;
      if (!available) writeFailed = true;
      changed();
      return available;
    } catch {
      writeFailed = true;
      state = { ...state, storageAvailable: false };
      changed();
      return false;
    }
  }
  return {
    read,
    saveRetry(next: CartRetry): boolean {
      const current = read();
      if (!current.storageAvailable || current.addPending || current.retryInvalid || (current.retry && !sameCartIntent(current.retry, next))) return false;
      return write(RETRY_KEY, JSON.stringify(next));
    },
    clearRetry: () => write(RETRY_KEY, null),
    startAdd(): boolean {
      const current = read();
      if (!current.storageAvailable || current.retry || current.retryInvalid || current.addPending) return false;
      return write(ADD_KEY, JSON.stringify({ version: 1 }));
    },
    clearAdd: () => write(ADD_KEY, null),
  };
}

/** Reject malformed legacy data instead of silently dropping unrecognized items. */
export function parseLegacyCart(raw: string): Array<{ variantId: string; quantity: number }> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("invalid legacy cart");
  const state = (parsed as { state?: unknown }).state;
  if (!state || typeof state !== "object") throw new Error("invalid legacy cart");
  const items = (state as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length > 30) throw new Error("invalid legacy cart");
  return items.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("invalid legacy cart");
    const value = item as { variantId?: unknown; quantity?: unknown };
    if (typeof value.variantId !== "string" || !value.variantId.length || value.variantId.length > 80 ||
      typeof value.quantity !== "number" || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 20) throw new Error("invalid legacy cart");
    return { variantId: value.variantId, quantity: value.quantity };
  });
}
