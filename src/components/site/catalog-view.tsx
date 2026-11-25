import { useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, X, Check as CheckIcon, Sparkles, Percent, PackageCheck, Flame } from "lucide-react";
import { useState } from "react";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import type { CatalogQuery, CategoryCard, ProductCard } from "@/lib/store-types";
import { ProductCardView } from "./product-card";
import { pageKicker, pageTitle } from "./ui";

const sorts = [
  ["popular", "پیشنهاد فروشگاه"],
  ["newest", "جدیدترین"],
  ["price-asc", "ارزان‌ترین"],
  ["price-desc", "گران‌ترین"],
] as const;

const PRICE_SLIDER_MIN = 50_000;
const PRICE_SLIDER_MAX = 3_000_000;
const PRICE_STEP = 25_000;

const PRICE_PRESETS = [
  { label: "همه مبالغ", max: null },
  { label: "زیر ۲۵۰ ت", max: 250_000 },
  { label: "زیر ۵۰۰ ت", max: 500_000 },
  { label: "زیر ۱ م", max: 1_000_000 },
  { label: "زیر ۲ م", max: 2_000_000 },
] as const;

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
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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

  const hasActiveFilters = Boolean(
    query.category !== "all" ||
      query.maxToman !== null ||
      query.organic ||
      query.discounted ||
      query.best ||
      query.available
  );

  const clearAllFilters = () => {
    void navigate({
      to: "/products",
      search: {
        category: "all",
        sort: "popular",
        q: undefined,
        max: undefined,
        organic: false,
        discounted: false,
        best: false,
        available: false,
      },
    });
  };

  const currentMax = query.maxToman ?? PRICE_SLIDER_MAX;
  const sliderPercent = Math.min(100, Math.max(0, ((currentMax - PRICE_SLIDER_MIN) / (PRICE_SLIDER_MAX - PRICE_SLIDER_MIN)) * 100));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={pageKicker}>SHAHOO SELECTION</p>
          <h1 className={pageTitle}>فروشگاه محصولات شاهو</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-muted">
            روغن‌های خالص فرابکر، کره‌های آجیلی طبیعی، مغزها و گیاهان دارویی منتخب. تمامی قیمت‌ها به تومان است.
          </p>
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-cream/70 px-4 py-2 text-xs font-bold text-forest transition hover:bg-gold/20"
          >
            <X className="h-3.5 w-3.5" />
            پاک کردن تمام فیلترها
          </button>
        ) : null}
      </header>

      {/* Category Pills Slider */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <FilterButton active={query.category === "all"} onClick={() => setSearch({ category: "all" })} label="همه محصولات" />
        {categories.map((category) => (
          <FilterButton
            key={category.id}
            active={query.category === category.slug}
            onClick={() => setSearch({ category: category.slug })}
            label={category.shortName}
          />
        ))}
      </div>

      {/* Mobile Toggle Button */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm font-bold text-forest shadow-sm"
        >
          <SlidersHorizontal className="h-4 w-4" />
          فیلترهای پیشرفته {hasActiveFilters ? "(فعال)" : ""}
        </button>
        <p className="text-xs text-muted">{toPersianNum(products.length)} کالا</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Products Grid */}
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/60 bg-paper/60 px-4 py-2.5">
            <p className="text-sm font-bold text-forest">{toPersianNum(products.length)} کالا در دسته‌بندی</p>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs font-medium text-muted">مرتب‌سازی:</span>
              <select
                value={query.sort}
                onChange={(event) => setSearch({ sort: event.target.value as CatalogQuery["sort"] })}
                className="h-10 rounded-xl border border-line bg-paper px-3 text-xs font-bold text-ink focus:border-gold focus:outline-none"
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
            <div className="rounded-3xl border border-line bg-paper p-12 text-center">
              <p className="text-base font-bold text-forest">هیچ محصولی با فیلترهای انتخابی یافت نشد.</p>
              <p className="mt-2 text-xs text-muted">پیشنهاد می‌کنیم سقف قیمت را افزایش داده یا فیلترها را حذف کنید.</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-5 rounded-full bg-forest px-6 py-2.5 text-xs font-bold text-ivory hover:bg-deep"
              >
                مشاهده همه محصولات
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map((product) => (
                <ProductCardView key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>

        {/* Rich Advanced Filters Sidebar */}
        <aside
          className={`${
            mobileFilterOpen ? "block" : "hidden"
          } space-y-6 rounded-3xl border border-gold/40 bg-cream/80 p-6 shadow-sm backdrop-blur-sm lg:sticky lg:top-24 lg:col-span-4 lg:block lg:h-fit`}
        >
          <div className="flex items-center justify-between border-b border-gold/30 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-forest">
              <SlidersHorizontal className="h-4 w-4 text-gold" />
              فیلترهای هوشمند
            </h2>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-bold text-forest/70 hover:text-forest hover:underline"
              >
                پاک کردن
              </button>
            ) : null}
          </div>

          {/* Graphical Price Slider Section */}
          <div className="space-y-3 rounded-2xl border border-line/70 bg-paper/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-forest">محدوده قیمت</span>
              <span className="rounded-md bg-gold/15 px-2 py-0.5 text-xs font-bold text-forest tabular-nums">
                {query.maxToman == null
                  ? "تا سقف " + formatTomanFromIrr(PRICE_SLIDER_MAX * 10)
                  : "تا " + formatTomanFromIrr(query.maxToman * 10)}
              </span>
            </div>

            {/* Custom Track Slider */}
            <div className="relative pt-2">
              <div className="relative h-2 w-full rounded-full bg-line">
                <div
                  className="absolute start-0 top-0 h-full rounded-full bg-forest transition-all duration-150"
                  style={{ width: `${sliderPercent}%` }}
                />
              </div>
              <input
                type="range"
                min={PRICE_SLIDER_MIN}
                max={PRICE_SLIDER_MAX}
                step={PRICE_STEP}
                value={currentMax}
                aria-label="حداکثر سقف قیمت"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setSearch({ maxToman: next >= PRICE_SLIDER_MAX ? null : next });
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>

            <div className="flex justify-between text-[11px] text-muted">
              <span>از {formatTomanFromIrr(PRICE_SLIDER_MIN * 10)}</span>
              <span>تا {formatTomanFromIrr(PRICE_SLIDER_MAX * 10)}</span>
            </div>

            {/* Quick Price Preset Chips */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              {PRICE_PRESETS.map((preset) => {
                const isActive = query.maxToman === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSearch({ maxToman: preset.max })}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      isActive
                        ? "bg-forest text-ivory shadow-xs"
                        : "border border-line bg-paper text-muted hover:border-gold hover:text-forest"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Attribute Switches */}
          <div className="space-y-2.5 rounded-2xl border border-line/70 bg-paper/80 p-4">
            <h3 className="text-xs font-bold text-forest">ویژگی‌ها و وضعیت کالا</h3>

            <VisualToggle
              label="فقط کالاهای موجود در انبار"
              icon={<PackageCheck className="h-4 w-4 text-emerald-700" />}
              checked={query.available}
              onChange={(available) => setSearch({ available })}
            />

            <VisualToggle
              label="تخفیف‌دار و قیمت ویژه"
              icon={<Percent className="h-4 w-4 text-amber-600" />}
              checked={query.discounted}
              onChange={(discounted) => setSearch({ discounted })}
            />

            <VisualToggle
              label="محصولات طبیعی"
              icon={<Sparkles className="h-4 w-4 text-gold" />}
              checked={query.organic}
              onChange={(organic) => setSearch({ organic })}
            />

            <VisualToggle
              label="پرفروش‌ترین‌های شاهو"
              icon={<Flame className="h-4 w-4 text-rose-600" />}
              checked={query.best}
              onChange={(best) => setSearch({ best })}
            />
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
      className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${
        active
          ? "border border-forest bg-forest text-ivory shadow-sm"
          : "border border-line bg-paper text-forest hover:border-gold hover:bg-cream"
      }`}
    >
      {label}
    </button>
  );
}

function VisualToggle({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-line/40 bg-cream/30 p-2.5 transition hover:bg-cream/60">
      <div className="flex items-center gap-2 text-xs font-bold text-forest">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
          checked ? "bg-forest" : "bg-line"
        }`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? "-translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
    </label>
  );
}
