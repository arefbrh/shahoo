import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EMPTY_GUEST_WISHLIST,
  reconcileWishlist,
  type ServerWishlistState,
  type WishlistScope,
} from "./wishlist-rules.ts";

type WishlistState = {
  ids: string[];
  scope: WishlistScope;
  /** Guest ids not yet confirmed by the server after a login (see wishlist-sync.ts). */
  pending: string[];
  /** Replace the list with an already-computed state (see wishlist-rules.ts). */
  set: (next: { ids: string[]; scope: WishlistScope; pending?: string[] }) => void;
  /** Align the browser copy with who the server says is signed in. */
  reconcile: (server: ServerWishlistState) => void;
};

/**
 * Browser wishlist. Version 2 tags the list with its owner scope so one customer's
 * list can never be shown to, or merged into, another session. A version-1 list
 * (no tag) is kept for guests but is never merged into an account.
 */
export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ...EMPTY_GUEST_WISHLIST,
      pending: [],
      set: (next) => set({ ids: next.ids, scope: next.scope, pending: next.pending ?? get().pending }),
      reconcile: (server) => {
        const { ids, scope } = get();
        const next = reconcileWishlist({ ids, scope }, server);
        set({ ids: next.ids, scope: next.scope });
      },
    }),
    {
      name: "shahoo-wishlist-v1",
      version: 3,
      partialize: (state) => ({ ids: state.ids, scope: state.scope, pending: state.pending }),
      migrate: (persisted) => {
        const old = (persisted ?? {}) as { ids?: unknown; scope?: unknown; pending?: unknown };
        const strings = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
        // Version 1 had no owner tag; version 2 had no pending list. Keep what is known, never merge an untagged list.
        const scope: WishlistScope = old.scope === "guest" || old.scope === "account" ? old.scope : "unknown";
        return { ids: strings(old.ids), scope, pending: strings(old.pending) };
      },
    },
  ),
);
