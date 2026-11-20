import { useWishlist } from "@/lib/cart-store";
import { createWishlistSync } from "@/lib/wishlist-sync";
import { mergeWishlistFn, toggleWishlistFn, wishlistStateFn } from "@/server/account/api";

/** The one wishlist controller of the browser tab: it owns the request gate and the in-flight flags. */
export const wishlistSync = createWishlistSync(
  {
    get: () => {
      const { ids, scope, pending } = useWishlist.getState();
      return { ids, scope, pending };
    },
    set: (next) => useWishlist.getState().set(next),
  },
  {
    fetchState: () => wishlistStateFn(),
    toggle: (productId) => toggleWishlistFn({ data: { productId } }),
    merge: (productIds) => mergeWishlistFn({ data: { productIds } }),
  },
);
