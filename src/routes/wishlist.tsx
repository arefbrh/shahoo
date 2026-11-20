import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProductCardView } from "@/components/site/product-card";
import { listCatalog } from "@/server/storefront/api";
import { wishlistSync } from "@/components/site/wishlist-client";
import { useWishlist } from "@/lib/cart-store";
import type { ProductCard } from "@/lib/store-types";
import { buttonGhost, pageKicker, pageTitle } from "@/components/site/ui";
import { noindex } from "@/lib/seo";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "علاقه‌مندی‌ها | شاهو" }, noindex] }),
  component: WishlistPage,
});

function WishlistPage() {
  const localIds = useWishlist((state) => state.ids);
  const scope = useWishlist((state) => state.scope);
  const [accountIds, setAccountIds] = useState<string[] | null>(null);
  const [inactive, setInactive] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    Promise.all([listCatalog({ data: {} }), wishlistSync.load()])
      .then(([catalog, loaded]) => {
        if (cancelled) return;
        setProducts(catalog.products);
        if (loaded.status === "failed") {
          setFailed(true);
          return;
        }
        // "stale": a newer action already updated the list; keep what is shown.
        if (loaded.status !== "applied") return;
        const wish = loaded.server;
        if (wish.mode === "account") {
          setAccountIds(wish.items.map((item) => item.id));
          setInactive(wish.items.filter((item) => item.active === false).map((item) => item.name ?? ""));
        } else {
          setAccountIds(null);
          setInactive([]);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Never show a leftover account copy to a visitor: only a guest list is shown without a server confirmation.
  const ids = accountIds ?? (scope === "guest" ? localIds : []);
  const picked = products.filter((product) => ids.includes(product.id));
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className={pageKicker}>SHAHOO</p>
      <h1 className={pageTitle}>علاقه‌مندی‌ها</h1>
      <p className="mt-2 max-w-xl text-sm leading-7 text-muted">
        {accountIds ? "این فهرست به حساب شما وصل است و روی دستگاه‌های دیگر همین حساب هم دیده می‌شود." : "تا وقتی وارد نشده‌اید، فهرست فقط روی همین مرورگر می‌ماند."}
      </p>
      {loading ? (
        <p className="mt-6 text-sm" role="status">
          در حال خواندن علاقه‌مندی‌ها...
        </p>
      ) : null}
      {failed ? (
        <div className="mt-6 text-sm" role="alert">
          <p>علاقه‌مندی‌ها خوانده نشد. اتصال را بررسی کنید.</p>
          <button type="button" className={`mt-3 ${buttonGhost}`} onClick={() => setAttempt((count) => count + 1)}>
            تلاش دوباره
          </button>
        </div>
      ) : null}
      {inactive.length > 0 ? <p className="mt-3 text-sm text-forest">دیگر در فروش نیست: {inactive.join("، ")}</p> : null}
      {!loading && !failed && picked.length === 0 && inactive.length === 0 ? <p className="mt-6 text-sm">هنوز محصولی نشان نشده است.</p> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picked.map((product) => (
          <ProductCardView key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
