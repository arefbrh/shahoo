import assert from "node:assert/strict";
import test from "node:test";
import {
  WISHLIST_SAVE_FAILED,
  applyWishlistToggle,
  idsToMergeOnLogin,
  reconcileWishlist,
  wishlistAfterLogout,
  type WishlistLocal,
} from "./wishlist-rules.ts";

const guest = (...ids: string[]): WishlistLocal => ({ ids, scope: "guest" });
const account = (...ids: string[]): WishlistLocal => ({ ids, scope: "account" });
const unknown = (...ids: string[]): WishlistLocal => ({ ids, scope: "unknown" });

test("customer A's list is not merged into customer B after logout and a new login", () => {
  // A signs in: the page stores A's server list as an account copy.
  const afterA = reconcileWishlist(guest(), { mode: "account", items: [{ id: "a1" }, { id: "a2" }] });
  assert.deepEqual(afterA, account("a1", "a2"));
  // Logout clears it, so B's login has nothing of A's to merge.
  const afterLogout = wishlistAfterLogout();
  assert.deepEqual(afterLogout, guest());
  assert.deepEqual(idsToMergeOnLogin(afterLogout), []);
  // Even if the logout handler never ran (cookie expired), an account copy is never merged.
  assert.deepEqual(idsToMergeOnLogin(afterA), []);
  assert.deepEqual(idsToMergeOnLogin(unknown("old")), []);
});

test("a genuine guest list is merged once and de-duplicated", () => {
  assert.deepEqual(idsToMergeOnLogin(guest("p1", "p2", "p1")), ["p1", "p2"]);
});

test("B signing in sees only B's server list, not A's leftovers", () => {
  const leftover = account("a1", "a2");
  assert.deepEqual(reconcileWishlist(leftover, { mode: "account", items: [{ id: "b1" }] }), account("b1"));
});

test("a visitor without a session never sees a leftover account copy", () => {
  assert.deepEqual(reconcileWishlist(account("a1"), { mode: "guest" }), guest());
  assert.deepEqual(reconcileWishlist(unknown("x"), { mode: "guest" }), guest());
});

test("guest list is preserved for a guest session", () => {
  const kept = reconcileWishlist(guest("g1"), { mode: "guest" });
  assert.deepEqual(kept, guest("g1"));
});

test("a failed toggle never changes the list and reports a Persian notice", () => {
  const before = account("a1");
  for (const outcome of [null, { ok: false as const, message: "x" }, { ok: false as const }]) {
    const result = applyWishlistToggle(before, "p9", outcome);
    assert.deepEqual(result.state, before);
    assert.equal(result.notice, WISHLIST_SAVE_FAILED);
  }
});

test("toggle for a signed-in customer takes the server list (no local guess)", () => {
  const result = applyWishlistToggle(account("a1"), "p2", { mode: "account", items: [{ id: "a1" }, { id: "p2" }] });
  assert.deepEqual(result.state, account("a1", "p2"));
  assert.equal(result.notice, null);
});

test("repeated toggles on a guest list add then remove; a guest toggle never starts from an account copy", () => {
  const added = applyWishlistToggle(guest(), "p1", { mode: "guest" });
  assert.deepEqual(added.state, guest("p1"));
  const removed = applyWishlistToggle(added.state, "p1", { mode: "guest" });
  assert.deepEqual(removed.state, guest());
  // Session ended while an account copy was still stored: start fresh as a guest.
  const fresh = applyWishlistToggle(account("a1", "a2"), "p3", { mode: "guest" });
  assert.deepEqual(fresh.state, guest("p3"));
});
