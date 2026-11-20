/**
 * Cart client-state helpers (Batch 03). Pure, no imports.
 * The server stays the only source of prices, totals and stock.
 */

/** Only the newest request may update the screen; older responses are dropped. */
export function createLatestGate() {
  let latest = 0;
  return {
    next(): number {
      latest += 1;
      return latest;
    },
    isLatest(ticket: number): boolean {
      return ticket === latest;
    },
  };
}

/** Per-page coordination for server-cart readers and absolute-quantity writes. */
export function createCartWriteGate() {
  let revision = 0;
  let pending = false;
  return {
    revision: () => revision,
    pending: () => pending,
    invalidate: () => { revision += 1; },
    begin: (): (() => void) | null => {
      if (pending) return null;
      pending = true;
      revision += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        pending = false;
        revision += 1;
      };
    },
  };
}

export const CART_READ_FAILED = "سبد از سرور خوانده نشد. دوباره تلاش کنید.";
export const CART_UPDATE_FAILED = "نتیجهٔ تغییر سبد مشخص نشد و ممکن است ثبت شده باشد. سبد دوباره بررسی می‌شود؛ می‌توانید همین تغییر را دوباره ثبت کنید.";

/** Quantity the customer typed, kept inside what the line can show. The server re-checks it. */
export function clampDraftQuantity(raw: string, sellable: number): number {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(1, Math.min(20, sellable)));
}
