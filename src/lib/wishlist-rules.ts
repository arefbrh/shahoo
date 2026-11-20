/**
 * Wishlist client-state rules (Batch 03). Pure, no imports.
 *
 * The browser keeps one persisted list. It is tagged with whose list it is:
 *  - "guest":   the visitor built it while signed out
 *  - "account": a copy of the signed-in customer's server list
 *  - "unknown": persisted by an older build, origin not known
 * Only a "guest" list may ever be merged into an account, and an "account" copy
 * never survives logout, a login as someone else, or a session that is gone.
 */
export type WishlistScope = "guest" | "account" | "unknown";
export type WishlistLocal = { ids: string[]; scope: WishlistScope };

export const EMPTY_GUEST_WISHLIST: WishlistLocal = { ids: [], scope: "guest" };

export const WISHLIST_SAVE_FAILED = "ذخیره علاقه‌مندی انجام نشد. دوباره تلاش کنید.";

export type SavedItem = { id: string; name?: string; active?: boolean };
export type ServerWishlistState = { mode: "account"; items: SavedItem[] } | { mode: "guest" };

/** What the page should hold once the server has said who is signed in. */
export function reconcileWishlist(local: WishlistLocal, server: ServerWishlistState): WishlistLocal {
  if (server.mode === "account") return { ids: dedupe(server.items.map((item) => item.id)), scope: "account" };
  return local.scope === "guest" ? local : EMPTY_GUEST_WISHLIST;
}

/** Ids that may be copied into an account after login: only a genuine guest list. */
export function idsToMergeOnLogin(local: WishlistLocal): string[] {
  return local.scope === "guest" ? dedupe(local.ids) : [];
}

export function wishlistAfterLogout(): WishlistLocal {
  return EMPTY_GUEST_WISHLIST;
}

export type ToggleOutcome =
  | { mode: "account"; items: Array<{ id: string }> }
  | { mode: "guest" }
  | { ok: false; message?: string }
  | null; // network/server error

/**
 * Result of pressing the heart. A failed request never changes the list, so the
 * heart cannot claim something the server did not store. `notice` is non-null
 * only on failure.
 */
export function applyWishlistToggle(
  local: WishlistLocal,
  productId: string,
  outcome: ToggleOutcome,
): { state: WishlistLocal; notice: string | null } {
  if (outcome === null || ("ok" in outcome && outcome.ok === false)) {
    return { state: local, notice: WISHLIST_SAVE_FAILED };
  }
  if ("mode" in outcome && outcome.mode === "account") {
    return { state: { ids: dedupe(outcome.items.map((item) => item.id)), scope: "account" }, notice: null };
  }
  // Guest session (also: the account session ended). Start from a guest list, never from a leftover account copy.
  const base = local.scope === "guest" ? local.ids : [];
  const ids = base.includes(productId) ? base.filter((id) => id !== productId) : [...base, productId];
  return { state: { ids, scope: "guest" }, notice: null };
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Browser wishlist as the store holds it. `pending` is guest data that has not yet been
 * confirmed by the server after a login. It is kept apart from `ids` so that guest data,
 * the signed-in customer's list and the migration status stay distinguishable.
 */
export type WishlistSnapshot = WishlistLocal & { pending: string[] };

export const WISHLIST_MIGRATE_FAILED =
  "انتقال علاقه‌مندی‌های این مرورگر به حساب شما انجام نشد. فهرست همچنان روی همین مرورگر نگه داشته شده است؛ دوباره تلاش کنید.";
export const WISHLIST_MIGRATE_DONE = "علاقه‌مندی‌های این مرورگر به حساب شما منتقل شد.";

/** Logout: an account copy is dropped; guest data that never reached the server comes back as the guest list. */
export function snapshotAfterLogout(snapshot: WishlistSnapshot): WishlistSnapshot {
  return { ids: dedupe(snapshot.pending), scope: "guest", pending: [] };
}

/** No session any more: unmigrated guest data is a guest list again, never discarded. */
export function snapshotWithoutSession(snapshot: WishlistSnapshot): WishlistSnapshot {
  const base = reconcileWishlist(snapshot, { mode: "guest" });
  return { ids: dedupe([...base.ids, ...snapshot.pending]), scope: "guest", pending: [] };
}

/**
 * Only an explicit `{ mode: "account", items: [...] }` confirms a merge. `{ mode: "guest" }`
 * (no session), `{ ok: false }` and any other shape are failures.
 */
export function parseMergeReply(reply: unknown): { ok: true; ids: string[] } | { ok: false } {
  if (typeof reply !== "object" || reply === null) return { ok: false };
  const value = reply as { mode?: unknown; items?: unknown };
  if (value.mode !== "account" || !Array.isArray(value.items)) return { ok: false };
  const ids: string[] = [];
  for (const item of value.items) {
    if (typeof item !== "object" || item === null || typeof (item as { id?: unknown }).id !== "string") return { ok: false };
    ids.push((item as { id: string }).id);
  }
  return { ok: true, ids: dedupe(ids) };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/**
 * Stale-response protection. A read may be applied only when no customer action ran since it
 * started and it is the newest read. Actions call `mutate()` when they start and when they finish.
 */
export function createReadGate() {
  let revision = 0;
  let latestRead = 0;
  return {
    mutate(): void {
      revision += 1;
    },
    begin(): { revision: number; read: number } {
      latestRead += 1;
      return { revision, read: latestRead };
    },
    accept(ticket: { revision: number; read: number }): boolean {
      return ticket.revision === revision && ticket.read === latestRead;
    },
  };
}
