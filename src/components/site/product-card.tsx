import { Link } from "@tanstack/react-router";
import { formatTomanFromIrr } from "@/lib/format";
import { isShopImage } from "@/lib/media-bytes";
import type { ProductCard } from "@/lib/store-types";
import { ProductMark } from "./product-mark";

export function ProductCardView({ product }: { product: ProductCard }) {
  const discounted = product.compareAtPriceIrr !== null && product.compareAtPriceIrr > product.priceIrr;
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-paper transition hover:border-gold">
      <Link to="/product/$productId" params={{ productId: product.slug }} className="block">
        {isShopImage(product.imageUrl) ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <ProductMark iconType={product.iconType} title={product.homepageTitle} subtitle={product.homepageSubtitle} />
        )}
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {product.isOrganic ? <span className="rounded-full bg-cream px-2 py-1 text-forest">طبیعی</span> : null}
          {discounted ? <span className="rounded-full bg-gold-soft px-2 py-1 text-deep">تخفیف</span> : null}
          {!product.inStock ? <span className="rounded-full bg-line px-2 py-1 text-muted">ناموجود</span> : null}
        </div>
        <div>
          <p className="text-xs text-gold">{product.categoryName}</p>
          <h3 className="mt-1 text-base font-bold text-forest">
            <Link to="/product/$productId" params={{ productId: product.slug }}>
              {product.name}
            </Link>
          </h3>
          <p className="mt-1 text-xs leading-6 text-muted">{product.subtitle}</p>
        </div>
        <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
          <div>
            <p className="text-sm font-bold tabular-nums text-forest">{formatTomanFromIrr(product.priceIrr)}</p>
            {discounted && product.compareAtPriceIrr ? (
              <p className="text-xs text-muted line-through tabular-nums">{formatTomanFromIrr(product.compareAtPriceIrr)}</p>
            ) : null}
          </div>
          <p className="text-xs text-muted">{product.variantLabel}</p>
        </div>
      </div>
    </article>
  );
}
