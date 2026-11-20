import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { isPublicHomeSection } from "@/lib/cms-rules";
import { toPersianNum } from "@/lib/format";
import { carouselImageIndices, carouselIndex, carouselIndicatorTargets } from "@/lib/home-carousel";
import { storyIsConfigured } from "@/lib/public-profile";
import type { HomeData, ProductCard } from "@/lib/store-types";
import { ProductCardView } from "./product-card";
import { buttonGold } from "./ui";

export function HomeView({ data }: { data: HomeData }) {
  return (
    <div>
      {data.sections.map((section) => {
        if (!isPublicHomeSection(section)) return null;
        if (section.sectionType === "hero") return <Hero key={section.id} banners={data.banners} settings={data.carousel} />;
        if (section.sectionType === "featured_categories") {
          return (
            <Section key={section.id} title={section.title} subtitle={section.subtitle} body={section.body}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.categories.map((category) => (
                  <a
                    key={category.id}
                    href={`/products?category=${category.slug}`}
                    className="rounded-3xl border border-line bg-paper p-5 transition-colors hover:border-gold active:border-gold active:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                  >
                    <span className="block h-px w-10 bg-gold" />
                    <p className="mt-3 font-display text-xs text-gold">{category.englishName}</p>
                    <h3 className="mt-2 text-lg font-bold text-forest">{category.name}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted">{category.description}</p>
                  </a>
                ))}
              </div>
            </Section>
          );
        }
        if (section.sectionType === "featured_products" || section.sectionType === "best_sellers" || section.sectionType === "new_arrivals" || section.sectionType === "special_offers") {
          const products = pickProducts(data.products, section.config.flags ?? [], section.config.limit ?? 4);
          return (
            <Section key={section.id} title={section.title} subtitle={section.subtitle} body={section.body}>
              {products.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {products.map((product) => (
                    <ProductCardView key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <p className="rounded-3xl border border-line bg-paper p-5 text-sm leading-7 text-muted">
                  هنوز محصولی برای نمایش در این بخش وجود ندارد.
                </p>
              )}
            </Section>
          );
        }
        if (section.sectionType === "brand_introduction") {
          const story = storyIsConfigured(data.story) ? data.story : null;
          if (!story && !section.title.trim() && !section.body.trim()) return null;
          return (
            <section key={section.id} className="bg-cream">
              <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:py-16">
              <div className="rounded-3xl bg-forest p-8 text-ivory">
                <p className="font-display text-xs text-gold-soft">SHAHOO</p>
                {story ? <h2 className="mt-3 text-3xl font-bold">{story.title}</h2> : null}
                {story?.philosophy ? <p className="mt-4 text-sm leading-8 text-gold-soft">{story.philosophy}</p> : null}
              </div>
              <div className="flex flex-col justify-center">
                {section.title ? <h3 className="text-xl font-bold text-forest">{section.title}</h3> : null}
                {section.body ? <p className="mt-3 text-sm leading-8">{section.body}</p> : null}
                {story?.about ? <p className="mt-3 text-sm leading-8">{story.about}</p> : null}
              </div>
              </div>
            </section>
          );
        }
        if (section.sectionType === "brand_benefits") {
          return (
            <Section key={section.id} title={section.title} subtitle={section.subtitle} body={section.body}>
              <div className="grid gap-3 md:grid-cols-3">
                {(section.config.items ?? []).map((item) => (
                  <div key={item.title} className="rounded-3xl border border-gold/40 bg-cream p-5">
                    <span className="font-display text-xs text-gold">SHAHOO</span>
                    <h3 className="mt-2 font-bold text-forest">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7">{item.text}</p>
                  </div>
                ))}
              </div>
            </Section>
          );
        }
        if (section.sectionType === "magazine_articles") {
          return (
            <Section key={section.id} title={section.title} subtitle={section.subtitle} body={section.body}>
              <div className="grid gap-4 md:grid-cols-2">
                {data.articles.map((article) => (
                  <Link key={article.slug} to="/magazine/$articleId" params={{ articleId: article.slug }} className="rounded-3xl border border-line bg-paper p-5 transition-colors hover:border-gold active:border-gold active:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    <p className="text-xs font-bold text-gold">{article.categoryName}</p>
                    <h3 className="mt-2 text-lg font-bold text-forest">{article.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted">{article.excerpt}</p>
                    <p className="mt-3 text-xs">{toPersianNum(article.readMinutes)} دقیقه مطالعه</p>
                  </Link>
                ))}
              </div>
            </Section>
          );
        }
        if (section.sectionType === "newsletter") {
          return (
            <section key={section.id} className="mx-auto max-w-6xl px-4 py-10">
              <div className="rounded-3xl border border-gold/40 bg-forest p-6 text-ivory sm:p-8">
                <p className="font-display text-xs text-gold-soft">SHAHOO</p>
                <h2 className="mt-2 text-2xl font-bold">{section.title}</h2>
                {section.body ? <p className="mt-2 max-w-xl text-sm leading-7 text-gold-soft">{section.body}</p> : null}
                <p className="mt-2 max-w-xl text-sm leading-7 text-gold-soft">
                  {section.subtitle} تا اتصال سرویس پیامک، شماره موبایل در سایت ذخیره نمی‌شود.
                </p>
              </div>
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}

function pickProducts(products: ProductCard[], flags: string[], limit: number) {
  let list = [...products];
  if (flags.includes("best")) list = list.filter((product) => product.isBestSeller);
  if (flags.includes("featured")) {
    list = list.filter((product) => product.isFeatured).sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99));
  }
  if (flags.includes("offer")) {
    list = list.filter((product) => product.compareAtPriceIrr !== null && product.compareAtPriceIrr > product.priceIrr);
  }
  if (flags.includes("newest")) list = [...list].sort((a, b) => b.catalogOrder - a.catalogOrder);
  return list.slice(0, limit);
}

function Hero({ banners, settings }: { banners: HomeData["banners"]; settings: HomeData["carousel"] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [previousImageId, setPreviousImageId] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const hoveredRef = useRef(false);
  const carouselRef = useRef<HTMLElement>(null);
  const activeSlideRef = useRef<HTMLDivElement>(null);
  const rotationHintId = useId();
  // Start motion-disabled during SSR/hydration until the user's preference is known.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [documentHidden, setDocumentHidden] = useState(false);
  const activeIndex = carouselIndex(index, banners.length);
  const activeBannerId = banners[activeIndex]?.id ?? null;
  const rotating = settings.autoPlay && banners.length > 1 && !paused && !hovered && !focused && !reducedMotion && !documentHidden;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setDocumentHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => {
      // Recheck synchronously in case interaction or a preference changed before effect cleanup.
      if (pausedRef.current || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          hoveredRef.current || carouselRef.current?.contains(document.activeElement)) return;
      setPreviousImageId(activeBannerId);
      setIndex((current) => carouselIndex(current + 1, banners.length));
    }, settings.intervalMs);
    return () => window.clearInterval(timer);
  }, [rotating, banners.length, activeBannerId, settings.intervalMs]);

  useEffect(() => {
    if (previousImageId === null) return;
    const timer = window.setTimeout(() => setPreviousImageId(null), 500);
    return () => window.clearTimeout(timer);
  }, [previousImageId]);

  function navigate(target: number, control: HTMLButtonElement) {
    const nextIndex = carouselIndex(target, banners.length);
    // Safari can leave focus on a slide link after a pointer click on a control.
    if (nextIndex !== activeIndex && activeSlideRef.current?.contains(document.activeElement)) {
      control.focus({ preventScroll: true });
      if (activeSlideRef.current.contains(document.activeElement)) return;
    }
    pausedRef.current = true;
    setPaused(true);
    if (nextIndex !== activeIndex) setPreviousImageId(activeBannerId);
    setIndex(nextIndex);
  }

  function toggleRotation() {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }

  if (!banners.length) return null;
  // The CMS allows more than three banners. The three lines represent the current
  // group; previous/next still reach every active banner in its CMS order.
  const indicators = carouselIndicatorTargets(banners.length, activeIndex);
  const imageIndices = carouselImageIndices(banners.length, activeIndex);
  return (
    <section
      ref={carouselRef}
      className="border-b border-gold/30 bg-cream"
      aria-label="بنرهای صفحه نخست"
      aria-roledescription="گردونه"
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") {
          hoveredRef.current = true;
          setHovered(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") {
          hoveredRef.current = false;
          setHovered(false);
        }
      }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-3 pt-7 md:pb-5 md:pt-10">
        <div className="relative" aria-live={rotating ? "off" : "polite"} aria-atomic="false">
          {banners.map((slide, slideIndex) => {
            const active = slideIndex === activeIndex;
            // Keep only the already-loaded outgoing image for its fade; it is
            // removed after the transition and never eagerly loads another slide.
            const loadImage = imageIndices.includes(slideIndex) || slide.id === previousImageId;
            return (
              <div
                key={slide.id}
                ref={active ? activeSlideRef : undefined}
                role="group"
                aria-roledescription="اسلاید"
                aria-label={`${toPersianNum(slideIndex + 1)} از ${toPersianNum(banners.length)}`}
                aria-hidden={!active}
                className={`grid min-w-0 items-center gap-5 transition-opacity duration-500 motion-reduce:transition-none md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8 ${active ? "relative opacity-100" : "pointer-events-none absolute inset-x-0 top-0 max-h-full overflow-hidden opacity-0"}`}
              >
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <p className="font-sans text-xs font-bold leading-7 text-[#795d28] sm:text-sm">{slide.subtitle}</p>
                  <h1 className="mt-2 text-3xl font-bold leading-tight text-forest sm:text-4xl">{slide.title}</h1>
                  {slide.body ? <p className="mt-3 max-w-md text-sm leading-7">{slide.body}</p> : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a href={slide.ctaHref} tabIndex={active ? undefined : -1} className={`${buttonGold} min-w-0 max-w-full whitespace-normal py-2 text-center [overflow-wrap:anywhere] active:bg-gold-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}>
                      {slide.ctaLabel}
                    </a>
                  </div>
                </div>
                <div className="overflow-hidden rounded-3xl border border-gold/50 bg-paper p-3 sm:p-4">
                  {!loadImage ? (
                    <div aria-hidden="true" className="h-52 w-full sm:h-64 md:h-80" />
                  ) : slide.desktopUrl || slide.mobileUrl ? (
                    <picture>
                      {slide.mobileUrl ? <source media="(max-width: 767px)" srcSet={slide.mobileUrl} /> : null}
                      <img src={slide.desktopUrl || slide.mobileUrl} alt={slide.imageAlt ?? ""} loading={active ? "eager" : "lazy"} fetchPriority={active ? "high" : "low"} className="mx-auto h-52 w-full object-contain sm:h-64 md:h-80" />
                    </picture>
                  ) : (
                    <img src="/assets/brand/shahoo-logo-primary.png" alt="" loading={active ? "eager" : "lazy"} fetchPriority={active ? "high" : "low"} className="mx-auto h-52 w-full object-contain sm:h-64 md:h-80" />
                  )}
                  <p dir="ltr" className="mt-2 text-center font-display text-xs text-[#795d28]">NATURAL · PURE · SHAHOO</p>
                </div>
              </div>
            );
          })}
        </div>
        {banners.length > 1 ? (
          <div className="mt-2 text-center">
            <button type="button" disabled={reducedMotion} aria-describedby={reducedMotion ? undefined : rotationHintId} onClick={toggleRotation} className="min-h-11 rounded-full px-3 text-xs font-bold text-forest transition-colors hover:text-[#795d28] active:bg-gold-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-70">
              {reducedMotion || !settings.autoPlay ? "نمایش خودکار غیرفعال است" : paused ? "ادامه نمایش خودکار" : "توقف نمایش خودکار"}
            </button>
            {!reducedMotion && settings.autoPlay ? (
              <p id={rotationHintId} aria-live="polite" className="mx-auto max-w-lg text-xs leading-6 text-muted">
                {paused ? "پس از انتخاب ادامه، نمایش خودکار با خروج نشانگر و فوکوس از گردونه آغاز می‌شود." : "نمایش خودکار هنگام حضور نشانگر یا فوکوس در گردونه متوقف است و پس از خروج هر دو ادامه می‌یابد."}
              </p>
            ) : null}
          </div>
        ) : null}
        {banners.length > 3 ? <p className="sr-only">برای دیدن سایر اسلایدها از دکمه‌های قبلی و بعدی استفاده کنید.</p> : null}
        <div className="mt-1 flex items-center justify-center gap-1 sm:gap-3">
          <button type="button" disabled={banners.length < 2} onClick={(event) => navigate(activeIndex - 1, event.currentTarget)} aria-label="اسلاید قبلی" className="min-h-11 rounded-full px-2 text-xs font-bold text-forest transition-colors hover:text-[#795d28] active:bg-gold-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-40">قبلی</button>
          <div className="flex items-center justify-center" role="group" aria-label="انتخاب اسلاید">
            {indicators.map((target, slot) => {
              const banner = target === null ? undefined : banners[target];
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={!banner}
                  aria-label={banner && target !== null ? `نمایش اسلاید ${toPersianNum(target + 1)}: ${banner.title}` : "اسلاید دیگری در این گروه نیست"}
                  aria-current={target === activeIndex ? "true" : undefined}
                  onClick={(event) => { if (target !== null) navigate(target, event.currentTarget); }}
                  className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-ivory active:bg-gold-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:hover:bg-transparent"
                >
                  <span aria-hidden="true" className={`h-1 rounded-full transition-all duration-300 motion-reduce:transition-none ${target === activeIndex ? "w-9 bg-forest" : banner ? "w-6 bg-gold" : "w-6 bg-line"}`} />
                </button>
              );
            })}
          </div>
          <button type="button" disabled={banners.length < 2} onClick={(event) => navigate(activeIndex + 1, event.currentTarget)} aria-label="اسلاید بعدی" className="min-h-11 rounded-full px-2 text-xs font-bold text-forest transition-colors hover:text-[#795d28] active:bg-gold-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-40">بعدی</button>
        </div>
      </div>
    </section>
  );
}

function Section({ title, subtitle, body, children }: { title: string; subtitle: string; body?: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6">
        <span className="block h-px w-12 bg-gold" />
        <h2 className="mt-3 text-2xl font-bold text-forest sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{subtitle}</p> : null}
        {body ? <p className="mt-2 max-w-2xl text-sm leading-8">{body}</p> : null}
      </div>
      {children}
    </section>
  );
}
