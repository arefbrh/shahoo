/**
 * Wishlist client orchestration (Batch 03 correction). No framework imports: the store and the
 * server functions are injected, so the same code runs in the browser and in tests.
 *
 *  - load():    read the server state; an older read can never overwrite a newer action.
 *  - toggle():  one heart action at a time; a failure changes nothing.
 *  - migrate(): copy the guest list into the signed-in account. Guest data is removed only
 *               after the server confirms it; failures keep it and can be retried.
 *  - logout():  drops an account copy, keeps unmigrated guest data as the guest list.
 */
import {
  WISHLIST_MIGRATE_FAILED,
  applyWishlistToggle,
  chunk,
  createReadGate,
  idsToMergeOnLogin,
  parseMergeReply,
  reconcileWishlist,
  snapshotAfterLogout,
  snapshotWithoutSession,
  type ServerWishlistState,
  type ToggleOutcome,
  type WishlistSnapshot,
} from "./wishlist-rules.ts";

export type WishlistPort = {
  get(): WishlistSnapshot;
  set(next: WishlistSnapshot): void;
};

export type WishlistServer = {
  fetchState(): Promise<ServerWishlistState>;
  toggle(productId: string): Promise<unknown>;
  /** At most MERGE_BATCH ids per call (the server rejects more). */
  merge(productIds: string[]): Promise<unknown>;
};

export const MERGE_BATCH = 40;

export type LoadResult =
  | { status: "applied"; server: ServerWishlistState }
  | { status: "stale" }
  | { status: "failed" };
export type ToggleResult = { status: "done" | "failed" | "busy"; notice: string | null };
export type MigrationResult = {
  status: "none" | "done" | "failed" | "busy";
  message: string | null;
  /** Ids the server skipped because the product no longer exists. They cannot be migrated. */
  dropped: string[];
};

export function createWishlistSync(port: WishlistPort, server: WishlistServer) {
  const gate = createReadGate();
  let toggling = false;
  let migrating = false;

  async function load(): Promise<LoadResult> {
    const ticket = gate.begin();
    let state: ServerWishlistState;
    try {
      state = await server.fetchState();
    } catch {
      return { status: "failed" };
    }
    // An action that is still running (or ran since this read began) is newer than this answer.
    if (toggling || migrating || !gate.accept(ticket)) return { status: "stale" };
    const current = port.get();
    if (state.mode === "guest") {
      port.set(snapshotWithoutSession(current));
    } else {
      const next = reconcileWishlist(current, state);
      port.set({ ids: next.ids, scope: next.scope, pending: current.pending });
    }
    return { status: "applied", server: state };
  }

  async function toggle(productId: string): Promise<ToggleResult> {
    if (toggling) return { status: "busy", notice: null };
    toggling = true;
    gate.mutate();
    try {
      let outcome: ToggleOutcome;
      try {
        outcome = (await server.toggle(productId)) as ToggleOutcome;
      } catch {
        outcome = null;
      }
      const current = port.get();
      const next = applyWishlistToggle({ ids: current.ids, scope: current.scope }, productId, outcome);
      port.set({ ...next.state, pending: current.pending });
      return { status: next.notice ? "failed" : "done", notice: next.notice };
    } finally {
      gate.mutate();
      toggling = false;
    }
  }

  async function migrate(): Promise<MigrationResult> {
    if (migrating) return { status: "busy", message: null, dropped: [] };
    migrating = true;
    gate.mutate();
    try {
      const start = port.get();
      const queue = [...new Set([...start.pending, ...idsToMergeOnLogin(start)])];
      if (queue.length === 0) return { status: "none", message: null, dropped: [] };
      // Persist the intent before the first request: a refresh or crash cannot lose the ids.
      port.set({ ids: start.ids, scope: start.scope, pending: queue });
      let remaining = queue;
      let confirmed: string[] = [];
      const dropped: string[] = [];
      for (const part of chunk(queue, MERGE_BATCH)) {
        let reply: unknown;
        try {
          reply = await server.merge(part);
        } catch {
          return { status: "failed", message: WISHLIST_MIGRATE_FAILED, dropped };
        }
        const parsed = parseMergeReply(reply);
        if (!parsed.ok) return { status: "failed", message: WISHLIST_MIGRATE_FAILED, dropped };
        confirmed = parsed.ids;
        dropped.push(...part.filter((id) => !parsed.ids.includes(id)));
        remaining = remaining.filter((id) => !part.includes(id));
        const progress = port.get();
        port.set({ ids: progress.ids, scope: progress.scope, pending: remaining });
      }
      // The server list is now authoritative; the guest copy is retired only here.
      port.set({ ids: confirmed, scope: "account", pending: [] });
      return { status: "done", message: null, dropped };
    } finally {
      gate.mutate();
      migrating = false;
    }
  }

  function logout(): void {
    gate.mutate();
    port.set(snapshotAfterLogout(port.get()));
  }

  return { load, toggle, migrate, logout, isMigrating: () => migrating };
}
