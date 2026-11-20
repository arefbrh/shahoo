import { useNavigate } from "@tanstack/react-router";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import type { CatalogQuery, CategoryCard, ProductCard } from "@/lib/store-types";
import { ProductCardView } from "./product-card";
import { pageKicker, pageTitle } from "./ui";

const sorts = [
  ["popular", "پیش‌فرض"],
  ["price-asc", "ارزان‌ترین"],
  ["price-desc", "گران‌ترین"],
  ["newest", "جدیدتر در کاتالوگ"],
] as const;

const PRICE_SLIDER_MAX = 50_000_000;

export function CatalogView({
  products,
  categories,
  query,
}: {
  products: ProductCard[];
  categories: CategoryCard[];
  query: CatalogQuery;
}) {
  const navigate = useNavigate();
  const setSearch = (patch: Partial<CatalogQuery> & { maxToman?: number | null }) => {
    const maxToman = "maxToman" in patch ? patch.maxToman ?? null : query.maxToman;
    void navigate({
      to: "/products",
      search: {
        category: patch.category ?? query.category,
        sort: patch.sort ?? query.sort,
        q: patch.q ?? query.q,
        max: maxToman ?? undefined,
        organic: patch.organic ?? query.organic,
        discounted: patch.discounted ?? query.discounted,
        best: patch.best ?? query.best,
        available: patch.available ?? query.available,
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className={pageKicker}>SHAHOO</p>
        <h1 className={pageTitle}>محصولات شاهو</h1>
        <p className="mt-2 max-w-xl text-sm leading-7 text-muted">طبیعت در خدمت خوراک و مراقبت روزمره. قیمت‌ها از پایگاه داده و به تومان است.</p>
      </header>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <FilterButton active={query.category === "all"} onClick={() => setSearch({ category: "all" })} label="همه" />
        {categories.map((category) => (
          <FilterButton
            key={category.id}
            active={query.category === category.slug}
            onClick={() => setSearch({ category: category.slug })}
            label={category.shortName}
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-forest">{toPersianNum(products.length)} محصول</p>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">مرتب‌سازی</span>
              <select
                value={query.sort}
                onChange={(event) => setSearch({ sort: event.target.value as CatalogQuery["sort"] })}
                className="h-11 rounded-xl border border-line bg-paper px-3"
              >
                {sorts.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {products.length === 0 ? (
            <p className="rounded-3xl border border-line bg-paper p-8 text-sm">محصولی با این فیلتر نیست.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map((product) => (
                <ProductCardView key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
        <aside className="h-fit space-y-4 rounded-3xl border border-gold/40 bg-cream p-5 lg:sticky lg:top-24 lg:col-span-4">
          <div>
            <h2 className="font-bold text-forest">سقف قیمت</h2>
            <input
              type="range"
              min={500_000}
              max={PRICE_SLIDER_MAX}
              step={100_000}
              value={query.maxToman ?? PRICE_SLIDER_MAX}
              aria-label="حداکثر قیمت"
              onChange={(event) => {
                const next = Number(event.target.value);
                setSearch({ maxToman: next >= PRICE_SLIDER_MAX ? null : next });
              }}
              className="mt-3 w-full accent-forest"
            />
            <p className="mt-2 text-xs font-bold">
              {query.maxToman == null ? "بدون سقف پیش‌فرض" : formatTomanFromIrr(query.maxToman * 10)}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <h2 className="font-bold text-forest">ویژگی‌ها</h2>
            <Check label="ارگانیک" checked={query.organic} onChange={(organic) => setSearch({ organic })} />
            <Check label="تخفیف‌دار" checked={query.discounted} onChange={(discounted) => setSearch({ discounted })} />
            <Check label="پرفروش" checked={query.best} onChange={(best) => setSearch({ best })} />
            <Check label="فقط موجود" checked={query.available} onChange={(available) => setSearch({ available })} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3 text-xs font-bold sm:text-sm ${active ? "border-forest bg-forest text-ivory" : "border-line bg-paper text-forest"}`}
    >
      {label}
    </button>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-forest" />
      {label}
    </label>
  );
}
