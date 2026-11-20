import { demoSeedAllowed } from "../env/runtime.ts";
import { and, eq, sql } from "drizzle-orm";
import { seedAccessControl } from "./access-seed.ts";
import { getDb } from "./client";
import {
  articleCategories,
  articleProducts,
  articles,
  banners,
  coupons,
  homepageSections,
  inventory,
  inventoryLogs,
  mediaAssets,
  navigationItems,
  navigationMenus,
  productCategories,
  productSpecs,
  productVariants,
  products,
  settings,
  sitePages,
  smsTemplates,
} from "./schema";
import { seedArticles, seedCategories, seedPages, seedProducts, variantPriceIrr } from "./seed-data";

const SEED_KEY = "foundation.seed";
const BASE_KEY = "foundation.baseline";
const SEED_VERSION = 1;

let pending: Promise<void> | null = null;
let privacyPatched = false;

export async function ensureSeed(): Promise<void> {
  pending ??= runSeed().finally(() => {
    pending = null;
  });
  await pending;
}

async function runSeed(): Promise<void> {
  const db = await getDb();
  await seedFoundation(db, { demo: demoSeedAllowed(process.env) });
  if (!privacyPatched) {
    await refreshStalePrivacyCopy(db);
    privacyPatched = true;
  }
}

type SeedTx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

/**
 * Permissions, SMS templates, logos, and empty store settings are baseline.
 * Contact details, shipping prices, and brand claims stay unset until an admin saves them.
 * Products, coupons, articles, and sample CMS rows are demonstration data.
 * Pass `{ demo: true }` only from a non-production opt-in. The default is false.
 */
export async function seedFoundation(
  db: Awaited<ReturnType<typeof getDb>>,
  options: { demo?: boolean } = {},
): Promise<void> {
  const includeDemo = options.demo === true;
  await db.transaction(async (tx) => {
    const [demoRow] = await tx.select().from(settings).where(eq(settings.key, SEED_KEY)).limit(1);
    if (demoRow) {
      await seedAccessControl(tx);
      return;
    }
    const [baseRow] = await tx.select().from(settings).where(eq(settings.key, BASE_KEY)).limit(1);
    if (!baseRow) await insertBaseline(tx);
    await seedAccessControl(tx);
    if (includeDemo) await insertDemo(tx);
  });
}

async function insertBaseline(tx: SeedTx): Promise<void> {
    await tx.insert(smsTemplates).values([
      { id: "sms-otp", key: "otp", body: "کد ورود شاهو: {code}\nاین کد تا چند دقیقه معتبر است." },
      { id: "sms-order", key: "order_confirmed", body: "سفارش {order} در شاهو ثبت شد." },
      { id: "sms-paid", key: "payment_confirmed", body: "پرداخت سفارش {order} تأیید شد." },
      { id: "sms-ship", key: "shipped", body: "سفارش {order} ارسال شد. کد رهگیری: {tracking}" },
      { id: "sms-cancel", key: "cancelled", body: "سفارش {order} لغو شد." },
    ]).onConflictDoNothing({ target: smsTemplates.key });

    await tx.insert(settings).values([
      {
        key: "store.profile",
        value: {
          brandName: "شاهو | SHAHOO",
          tagline: "محصولات طبیعی شاهو",
          phone: "",
          whatsapp: "",
          email: "",
          address: "",
          instagram: "",
          telegram: "",
          copyright: "تمام حقوق برای شاهو محفوظ است.",
        },
      },
      {
        key: "store.story",
        value: { title: "", about: "", philosophy: "" },
      },
      {
        key: "brand.logos",
        value: {
          header: "/assets/brand/shahoo-logo-minimal.png",
          footer: "/assets/brand/shahoo-logo-primary.png",
          headerPng: "/assets/brand/shahoo-logo-minimal.png",
          footerPng: "/assets/brand/shahoo-logo-primary.png",
        },
      },
      { key: "header.promo", value: { text: "" } },
      { key: BASE_KEY, value: { version: SEED_VERSION } },
    ]).onConflictDoNothing({ target: settings.key });
}

async function insertDemo(tx: SeedTx): Promise<void> {
    await tx.insert(mediaAssets).values([
      asset("media-logo-primary", "shahoo-logo-primary.png", "image/png", 931395, "/assets/brand/shahoo-logo-primary.png", "لوگوی اصلی شاهو"),
      asset("media-logo-minimal", "shahoo-logo-minimal.png", "image/png", 487626, "/assets/brand/shahoo-logo-minimal.png", "لوگوی مینیمال شاهو"),
      asset("media-icon-minimal", "shahoo-icon-minimal.png", "image/png", 271447, "/assets/brand/shahoo-icon-minimal.png", "نماد مینیمال شاهو"),
    ]);

    await tx.insert(productCategories).values([...seedCategories]);

    for (const product of seedProducts) {
      await tx.insert(products).values({
        id: product.id,
        categoryId: product.categoryId,
        slug: product.id,
        sku: product.sku,
        name: product.name,
        englishName: product.englishName,
        subtitle: product.subtitle,
        homepageTitle: product.homepageTitle,
        homepageSubtitle: product.homepageSubtitle,
        shortDescription: product.shortDescription,
        fullDescription: product.fullDescription,
        origin: product.origin,
        ingredients: product.ingredients,
        usageInstructions: product.usageInstructions,
        storageInstructions: product.storageInstructions,
        isOrganic: product.isOrganic,
        isBestSeller: product.isBestSeller,
        isFeatured: product.isFeatured,
        featuredOrder: product.featuredOrder ?? null,
        catalogOrder: product.catalogOrder,
        visualKey: product.visualKey,
        status: "published",
        seoTitle: product.name,
        seoDescription: product.shortDescription,
        oilFinder: product.oilFinder ?? null,
      });
      await tx.insert(productVariants).values(
        product.variants.map((variant, index) => {
          const prices = variantPriceIrr(variant);
          const marked = product.variants.some((item) => item.isDefault);
          return {
            id: variant.id,
            productId: product.id,
            sku: variant.sku,
            label: variant.label,
            unitKind: variant.unitKind,
            amount: variant.amount,
            priceIrr: prices.priceIrr,
            compareAtPriceIrr: prices.compareAtPriceIrr,
            isDefault: marked ? Boolean(variant.isDefault) : index === 0,
            sortOrder: index + 1,
            status: "active",
          };
        }),
      );
      await tx.insert(inventory).values(
        product.variants.map((variant) => ({
          variantId: variant.id,
          onHand: variant.stock,
          reserved: 0,
          lowStockThreshold: 5,
        })),
      );
      await tx.insert(inventoryLogs).values(
        product.variants.map((variant) => ({
          id: `open-${variant.id}`,
          variantId: variant.id,
          delta: variant.stock,
          reason: "opening_balance",
          note: "موجودی اولیه منتقل‌شده از کاتالوگ بتا",
          onHandBefore: 0,
          onHandAfter: variant.stock,
          reservedBefore: 0,
          reservedAfter: 0,
        })),
      );
      if (product.specs.length) {
        await tx.insert(productSpecs).values(
          product.specs.map((spec, index) => ({
            id: `${product.id}-spec-${index + 1}`,
            productId: product.id,
            label: spec.label,
            value: spec.value,
            sortOrder: index + 1,
          })),
        );
      }
    }

    await tx.insert(articleCategories).values([
      { id: "oils-journal", slug: "oils-journal", name: "روغن‌های گیاهی", sortOrder: 1 },
      { id: "nuts-journal", slug: "nuts-journal", name: "مغزیجات", sortOrder: 2 },
      { id: "herbs-journal", slug: "herbs-journal", name: "گیاهان دارویی", sortOrder: 3 },
      { id: "butters-journal", slug: "butters-journal", name: "کره مغزیجات", sortOrder: 4 },
    ]);
    for (const article of seedArticles) {
      await tx.insert(articles).values({
        id: article.id,
        categoryId: article.categorySlug,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: article.content,
        authorName: article.authorName,
        readMinutes: article.readMinutes,
        visualKey: article.visualKey,
        status: "published",
        seoTitle: article.title,
        seoDescription: article.excerpt,
        publishedAt: new Date("2025-11-01T00:00:00.000Z"),
      });
      await tx.insert(articleProducts).values(
        article.related.map((productId) => ({ articleId: article.id, productId })),
      );
    }

    await tx.insert(banners).values([
      {
        id: "slide-1",
        placement: "home-hero",
        subtitle: "طبیعت را خالص‌تر بخرید",
        title: "محصولات طبیعی شاهو",
        body: "سلامتی، کیفیت و اصالت در کنار شما",
        ctaLabel: "مشاهده محصولات",
        ctaHref: "/products",
        sortOrder: 1,
        visualKey: "hero-oils",
      },
      {
        id: "slide-2",
        placement: "home-hero",
        subtitle: "عصاره ناب طبیعت ایران",
        title: "روغن‌های گیاهی پرس سرد",
        body: "استخراج بدون حرارت شدید برای حفظ عطر دانه",
        ctaLabel: "مشاهده روغن‌ها",
        ctaHref: "/products?category=oils",
        sortOrder: 2,
        visualKey: "hero-black-seed",
      },
      {
        id: "slide-3",
        placement: "home-hero",
        subtitle: "دست‌چین از باغ و کوهستان",
        title: "مغزیجات و کره‌های طبیعی",
        body: "بدون نگهدارنده و بدون شکر افزوده",
        ctaLabel: "مشاهده مغزیجات",
        ctaHref: "/products?category=nuts",
        sortOrder: 3,
        visualKey: "hero-nuts",
      },
    ]);

    const existingSections = await tx.select({ id: homepageSections.id, sectionType: homepageSections.sectionType }).from(homepageSections);
    const existingSectionTypes = new Set(existingSections.map(({ sectionType }) => sectionType));
    const usedSectionIds = new Set(existingSections.map(({ id }) => id));
    const demoSections = [
      section("sec-hero", "hero", 1, "خانه", "", ""),
      section("sec-categories", "featured_categories", 2, "دسته‌های شاهو", "از روغن پرس سرد تا مغز دست‌چین", ""),
      section("sec-best", "best_sellers", 3, "پرفروش‌های شاهو", "انتخاب‌هایی که مشتریان شاهو بیشتر سراغشان می‌روند.", "", { limit: 4, flags: ["best"] }),
      section("sec-new", "new_arrivals", 4, "تازه‌های ماه", "تازه به شاهو رسیده‌اند؛ نگاهی به انتخاب‌های جدید بیندازید.", "", { limit: 4, flags: ["newest"] }),
      section("sec-offers", "special_offers", 5, "پیشنهادهای ویژه", "انتخاب‌های ویژه‌ای که شاید همان چیزی باشند که دنبالش هستید.", "", { limit: 4, flags: ["offer"] }),
      section("sec-story", "brand_introduction", 6, "چرا شاهو؟", "خلوص، دسته کوچک، صداقت", "در شاهو خلوص مواد اولیه و شفافیت فرآیند مهم‌تر از ادعاهای تبلیغاتی است."),
      section("sec-benefits", "brand_benefits", 7, "تعهد کارگاه", "", "", {
        items: [
          { title: "خلوص", text: "بدون افزودن روغن ارزان، شکر یا اسانس." },
          { title: "دسته کوچک", text: "تولید محدود تا روغن کهنه روی قفسه نماند." },
          { title: "صداقت", text: "منشأ روی صفحه محصول نوشته می‌شود. ادعای درمان نداریم." },
        ],
      }),
      section("sec-magazine", "magazine_articles", 9, "مجله شاهو", "یادداشت‌های کارگاه، نه تبلیغ درمان", ""),
      section("sec-newsletter", "newsletter", 10, "خبر محصولات تازه", "شماره موبایل شما ذخیره می‌شود؛ پیامک تا اتصال سرویس ارسال نمی‌شود.", ""),
    ].filter(({ sectionType }) => !existingSectionTypes.has(sectionType)).map((demoSection) => {
      // An existing custom row may own the demo ID even when its type differs.
      let id = demoSection.id;
      for (let suffix = 1; usedSectionIds.has(id); suffix += 1) id = `${demoSection.id}-${suffix}`;
      usedSectionIds.add(id);
      return { ...demoSection, id };
    });
    if (demoSections.length > 0) await tx.insert(homepageSections).values(demoSections);

    await tx.insert(navigationMenus).values([
      { id: "menu-header", key: "header", name: "منوی اصلی" },
      { id: "menu-footer-shop", key: "footer-shop", name: "فروشگاه" },
      { id: "menu-footer-help", key: "footer-help", name: "راهنما" },
    ]);
    await tx.insert(navigationItems).values([
      link("nav-home", "menu-header", "خانه", "/", 1),
      link("nav-products", "menu-header", "محصولات", "/products", 2),
      link("nav-oil", "menu-header", "راهنمای روغن", "/oil-guide", 3),
      link("nav-magazine", "menu-header", "مجله", "/magazine", 4),
      link("nav-about", "menu-header", "درباره ما", "/about", 5),
      link("nav-contact", "menu-header", "تماس", "/contact", 6),
      link("foot-products", "menu-footer-shop", "همه محصولات", "/products", 1),
      link("foot-oils", "menu-footer-shop", "روغن‌های گیاهی", "/products?category=oils", 2),
      link("foot-butters", "menu-footer-shop", "کره مغزیجات", "/products?category=butters", 3),
      link("foot-nuts", "menu-footer-shop", "مغزیجات", "/products?category=nuts", 4),
      link("foot-ship", "menu-footer-help", "ارسال", "/shipping", 1),
      link("foot-returns", "menu-footer-help", "بازگشت کالا", "/returns", 2),
      link("foot-faq", "menu-footer-help", "پرسش‌ها", "/faq", 3),
      link("foot-privacy", "menu-footer-help", "حریم خصوصی", "/privacy", 4),
      link("foot-terms", "menu-footer-help", "قوانین", "/terms", 5),
    ]);

    await tx.insert(coupons).values([
      {
        id: "coupon-shahoo10",
        code: "SHAHOO10",
        description: "۱۰٪ تخفیف خوش‌آمد، منتقل‌شده از کاتالوگ بتا",
        percentOff: 10,
        isActive: true,
      },
      {
        id: "coupon-organic20",
        code: "ORGANIC20",
        description: "۲۰٪ تخفیف جشنواره، منتقل‌شده از کاتالوگ بتا",
        percentOff: 20,
        isActive: true,
      },
    ]);

    await tx.insert(sitePages).values(
      seedPages.map((page) => ({
        id: `page-${page.slug}`,
        slug: page.slug,
        title: page.title,
        body: page.body,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        isPublished: true,
      })),
    );

  await tx.insert(settings).values([
    { key: SEED_KEY, value: { version: SEED_VERSION, source: "beta-catalog-v3" } },
  ]);
}

async function refreshStalePrivacyCopy(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  const privacy = seedPages.find((page) => page.slug === "privacy");
  if (!privacy) return;
  await db
    .update(sitePages)
    .set({ body: privacy.body, seoDescription: privacy.seoDescription, updatedAt: new Date() })
    .where(and(eq(sitePages.id, "page-privacy"), sql`${sitePages.body} like ${"%هنوز ورود مشتری را فعال نکرده%"}`));
}

function asset(id: string, filename: string, mimeType: string, byteSize: number, publicUrl: string, alt: string) {
  return {
    id,
    folder: "brand",
    filename,
    mimeType,
    byteSize,
    alt,
    storageKey: publicUrl,
    publicUrl,
  };
}

function section(
  id: string,
  sectionType: string,
  sortOrder: number,
  title: string,
  subtitle: string,
  body: string,
  config: { limit?: number; flags?: Array<"featured" | "best" | "offer" | "newest">; items?: Array<{ title: string; text: string }> } = {},
) {
  return { id, sectionType, sortOrder, title, subtitle, body, config, isActive: true, templateKey: "default", background: "" };
}

function link(id: string, menuId: string, label: string, href: string, sortOrder: number) {
  return { id, menuId, label, href, sortOrder, isActive: true, openInNewTab: false };
}
