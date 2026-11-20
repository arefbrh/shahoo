import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { bannerIsVisible, isRenderableMediaUrl, safeBannerImage } from "@/lib/cms-rules";
import { irrToToman } from "@/lib/money";
import { requestOrigin } from "../seo/origin";
import type {
  ArticleCard,
  ArticleDetail,
  BannerSlide,
  BrandLogos,
  CatalogQuery,
  CategoryCard,
  FooterColumn,
  HomeData,
  HomeSection,
  NavLink,
  ProductCard,
  ProductDetail,
  ShellData,
  SitePage,
  StoreProfile,
  StoreLayoutSettings,
  VariantChoice,
} from "@/lib/store-types";
import { getDb } from "../db/client";
import { passesMaxPrice } from "../catalog/rules";
import { publicPromo, storyIsConfigured } from "@/lib/public-profile";
import { isLineSellable } from "@/lib/commerce-integrity";
import { ensureSeed } from "../db/seed";
import {
  articleCategories,
  articleProducts,
  articles,
  banners,
  homepageSections,
  inventory,
  mediaAssets,
  navigationItems,
  navigationMenus,
  productCategories,
  productImages,
  productSpecs,
  productVariants,
  products,
  settings,
  sitePages,
} from "../db/schema";

const profileSchema = z.object({
  brandName: z.string(),
  tagline: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  email: z.string(),
  address: z.string(),
  instagram: z.string(),
  telegram: z.string(),
  copyright: z.string(),
});

const logosSchema = z.object({
  header: z.string(),
  footer: z.string(),
  headerPng: z.string(),
  footerPng: z.string(),
});

const storySchema = z.object({
  title: z.string(),
  about: z.string(),
  philosophy: z.string(),
});

const sectionConfigSchema = z.object({
  limit: z.number().optional(),
  flags: z.array(z.enum(["featured", "best", "offer", "newest"])).optional(),
  items: z.array(z.object({ title: z.string(), text: z.string() })).optional(),
});

const catalogSchema = z.object({
  category: z.string().optional(),
  sort: z.enum(["popular", "price-asc", "price-desc", "newest", "rating"]).optional(),
  q: z.string().max(80).optional(),
  maxToman: z.number().int().positive().max(50_000_000).optional(),
  organic: z.boolean().optional(),
  discounted: z.boolean().optional(),
  best: z.boolean().optional(),
  available: z.boolean().optional(),
});

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1).max(80),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(30),
});

async function readyDb() {
  await ensureSeed();
  return getDb();
}

function settingMap(rows: Array<{ key: string; value: unknown }>) {
  return new Map(rows.map((row) => [row.key, row.value]));
}

function toCard(row: {
  id: string;
  slug: string;
  name: string;
  englishName: string;
  subtitle: string;
  homepageTitle: string;
  homepageSubtitle: string;
  isOrganic: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  featuredOrder: number | null;
  catalogOrder: number;
  categorySlug: string;
  categoryName: string;
  iconType: string;
  variantId: string;
  variantLabel: string;
  priceIrr: number;
  compareAtPriceIrr: number | null;
  onHand: number;
  imageUrl?: string;
}): ProductCard {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    englishName: row.englishName,
    subtitle: row.subtitle,
    homepageTitle: row.homepageTitle || row.name,
    homepageSubtitle: row.homepageSubtitle,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
    iconType: row.iconType,
    isOrganic: row.isOrganic,
    isBestSeller: row.isBestSeller,
    isFeatured: row.isFeatured,
    featuredOrder: row.featuredOrder,
    catalogOrder: row.catalogOrder,
    priceIrr: row.priceIrr,
    compareAtPriceIrr: row.compareAtPriceIrr,
    inStock: row.onHand > 0,
    variantId: row.variantId,
    variantLabel: row.variantLabel,
    imageUrl: row.imageUrl ?? "",
  };
}

async function loadCards() {
  const db = await readyDb();
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      englishName: products.englishName,
      subtitle: products.subtitle,
      homepageTitle: products.homepageTitle,
      homepageSubtitle: products.homepageSubtitle,
      isOrganic: products.isOrganic,
      isBestSeller: products.isBestSeller,
      isFeatured: products.isFeatured,
      featuredOrder: products.featuredOrder,
      catalogOrder: products.catalogOrder,
      categorySlug: productCategories.slug,
      categoryName: productCategories.name,
      iconType: productCategories.iconType,
      variantId: productVariants.id,
      variantLabel: productVariants.label,
      priceIrr: productVariants.priceIrr,
      compareAtPriceIrr: productVariants.compareAtPriceIrr,
      onHand: sql<number>`(${inventory.onHand} - ${inventory.reserved})`.mapWith(Number),
    })
    .from(products)
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .innerJoin(
      productVariants,
      and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)),
    )
    .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(
      and(
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(productCategories.isActive, true),
        isNull(productCategories.deletedAt),
        eq(productVariants.status, "active"),
        isNull(productVariants.deletedAt),
      ),
    )
    .orderBy(asc(products.catalogOrder));
  const images = await db.select({ productId: productImages.productId, url: productImages.url }).from(productImages).where(eq(productImages.isPrimary, true));
  const imageByProduct = new Map(images.map((row) => [row.productId, row.url]));
  return rows.map((row) => toCard({ ...row, imageUrl: imageByProduct.get(row.id) ?? "" }));
}

export const getShell = createServerFn({ method: "GET" }).handler(async (): Promise<ShellData> => {
  const db = await readyDb();
  const [settingRows, headerLinks, footerShop, footerHelp] = await Promise.all([
    db.select().from(settings),
    db
      .select({ label: navigationItems.label, href: navigationItems.href, sortOrder: navigationItems.sortOrder })
      .from(navigationItems)
      .innerJoin(navigationMenus, eq(navigationItems.menuId, navigationMenus.id))
      .where(and(eq(navigationMenus.key, "header"), eq(navigationItems.isActive, true)))
      .orderBy(asc(navigationItems.sortOrder)),
    menuLinks(db, "footer-shop"),
    menuLinks(db, "footer-help"),
  ]);
  const map = settingMap(settingRows);
  const profile = profileSchema.parse(map.get("store.profile"));
  const logos = logosSchema.parse(map.get("brand.logos"));
  const layoutRaw = map.get("store.layout");
  const layoutConfig = layoutRaw && typeof layoutRaw === "object" ? (layoutRaw as Record<string, unknown>) : {};
  const clampLayout = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  const layout: StoreLayoutSettings = {
    stickyHeader: layoutConfig.stickyHeader !== false,
    headerLogoHeight: clampLayout(layoutConfig.headerLogoHeight, 56, 40, 80),
    footerLogoHeight: clampLayout(layoutConfig.footerLogoHeight, 112, 64, 144),
    footerAlignment: layoutConfig.footerAlignment === "center" ? "center" : "start",
  };
  const promoRaw = z.object({ text: z.string() }).parse(map.get("header.promo"));
  return {
    profile,
    logos,
    layout,
    promo: publicPromo(promoRaw.text),
    nav: headerLinks.map(link),
    footer: [
      { title: "فروشگاه", links: footerShop },
      { title: "راهنما", links: footerHelp },
    ],
  };
});

async function menuLinks(
  db: Awaited<ReturnType<typeof getDb>>,
  key: string,
): Promise<NavLink[]> {
  const rows = await db
    .select({ label: navigationItems.label, href: navigationItems.href })
    .from(navigationItems)
    .innerJoin(navigationMenus, eq(navigationItems.menuId, navigationMenus.id))
    .where(and(eq(navigationMenus.key, key), eq(navigationItems.isActive, true)))
    .orderBy(asc(navigationItems.sortOrder));
  return rows.map(link);
}

function link(row: { label: string; href: string }): NavLink {
  return { label: row.label, href: row.href };
}

export const getHome = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> => {
  const db = await readyDb();
  const [bannerRows, sectionRows, categoryRows, cards, articleRows, settingRows, mediaRows] = await Promise.all([
    db
      .select()
      .from(banners)
      .where(and(eq(banners.placement, "home-hero"), eq(banners.isActive, true)))
      .orderBy(asc(banners.sortOrder)),
    db.select().from(homepageSections).where(eq(homepageSections.isActive, true)).orderBy(asc(homepageSections.sortOrder)),
    db
      .select()
      .from(productCategories)
      .where(and(eq(productCategories.isActive, true), isNull(productCategories.deletedAt)))
      .orderBy(asc(productCategories.sortOrder)),
    loadCards(),
    db
      .select({
        slug: articles.slug,
        title: articles.title,
        excerpt: articles.excerpt,
        authorName: articles.authorName,
        readMinutes: articles.readMinutes,
        categoryName: articleCategories.name,
      })
      .from(articles)
      .leftJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
      .where(and(eq(articles.status, "published"), isNull(articles.deletedAt)))
      .orderBy(desc(articles.publishedAt)),
    db.select().from(settings),
    db.select({ id: mediaAssets.id, publicUrl: mediaAssets.publicUrl, alt: mediaAssets.alt, deletedAt: mediaAssets.deletedAt }).from(mediaAssets),
  ]);
  const parsedStory = storySchema.parse(settingMap(settingRows).get("store.story"));
  const story = storyIsConfigured(parsedStory) ? parsedStory : { title: "", about: "", philosophy: "" };
  const bannerMedia = new Map(mediaRows.filter((row) => !row.deletedAt).map((row) => [row.id, { url: row.publicUrl, alt: row.alt }]));
  const carouselRaw = settingMap(settingRows).get("home.carousel");
  const carouselConfig = carouselRaw && typeof carouselRaw === "object" ? (carouselRaw as Record<string, unknown>) : {};
  const carouselInterval = typeof carouselConfig.intervalMs === "number" ? carouselConfig.intervalMs : 6500;
  return {
    carousel: { autoPlay: carouselConfig.autoPlay !== false, intervalMs: Math.min(15000, Math.max(3000, carouselInterval)) },
    banners: bannerRows.filter((row) => bannerIsVisible(row.startsAt, row.endsAt, Date.now())).map((row) => toBanner(row, bannerMedia)),
    sections: sectionRows.map(toSection),
    categories: categoryRows.map(toCategory),
    products: cards,
    articles: articleRows.map((row) => ({
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      authorName: row.authorName,
      readMinutes: row.readMinutes,
      categoryName: row.categoryName ?? "",
    })),
    story,
  };
});

function toBanner(row: typeof banners.$inferSelect, media: Map<string, { url: string; alt: string }>): BannerSlide {
  const desktop = row.desktopMediaId ? media.get(row.desktopMediaId) : undefined;
  const mobile = row.mobileMediaId ? media.get(row.mobileMediaId) : undefined;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    desktopUrl: safeBannerImage(desktop?.url ?? ""),
    mobileUrl: safeBannerImage(mobile?.url ?? ""),
    imageAlt: desktop?.alt || mobile?.alt || "",
  };
}

function toSection(row: typeof homepageSections.$inferSelect): HomeSection {
  return {
    id: row.id,
    sectionType: row.sectionType,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    background: row.background,
    config: sectionConfigSchema.parse(row.config ?? {}),
  };
}

function toCategory(row: typeof productCategories.$inferSelect): CategoryCard {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    englishName: row.englishName,
    description: row.description,
    iconType: row.iconType,
  };
}

export const listCatalog = createServerFn({ method: "GET" })
  .validator((input: unknown): CatalogQuery => {
    const parsed = catalogSchema.parse(input ?? {});
    return {
      category: parsed.category && parsed.category !== "all" ? parsed.category : "all",
      sort: parsed.sort ?? "popular",
      q: parsed.q?.trim() ?? "",
      maxToman: parsed.maxToman ?? null,
      organic: parsed.organic ?? false,
      discounted: parsed.discounted ?? false,
      best: parsed.best ?? false,
      available: parsed.available ?? false,
    };
  })
  .handler(async ({ data }) => {
    const cards = (await loadCards()).filter((product) => {
      if (data.category !== "all" && product.categorySlug !== data.category) return false;
      if (!passesMaxPrice(irrToToman(product.priceIrr), data.maxToman)) return false;
      if (data.organic && !product.isOrganic) return false;
      if (data.discounted && !(product.compareAtPriceIrr && product.compareAtPriceIrr > product.priceIrr)) return false;
      if (data.best && !product.isBestSeller) return false;
      if (data.available && !product.inStock) return false;
      if (data.q) {
        const haystack = `${product.name} ${product.englishName} ${product.subtitle}`.toLowerCase();
        if (!haystack.includes(data.q.toLowerCase())) return false;
      }
      return true;
    });
    cards.sort((a, b) => {
      if (data.sort === "price-asc") return a.priceIrr - b.priceIrr;
      if (data.sort === "price-desc") return b.priceIrr - a.priceIrr;
      if (data.sort === "newest") return b.catalogOrder - a.catalogOrder;
      return a.catalogOrder - b.catalogOrder;
    });
    const db = await readyDb();
    const categories = await db
      .select()
      .from(productCategories)
      .where(and(eq(productCategories.isActive, true), isNull(productCategories.deletedAt)))
      .orderBy(asc(productCategories.sortOrder));
    return { products: cards, categories: categories.map(toCategory), query: data };
  });

export const getProduct = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }): Promise<ProductDetail | null> => {
    const db = await readyDb();
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, data.slug), eq(products.status, "published"), isNull(products.deletedAt)))
      .limit(1);
    if (!product) return null;
    const [category] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, product.categoryId))
      .limit(1);
    if (!category || !category.isActive || category.deletedAt) return null;
    const variantRows = await db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        label: productVariants.label,
        unitKind: productVariants.unitKind,
        amount: productVariants.amount,
        priceIrr: productVariants.priceIrr,
        compareAtPriceIrr: productVariants.compareAtPriceIrr,
        isDefault: productVariants.isDefault,
        sortOrder: productVariants.sortOrder,
        onHand: sql<number>`(${inventory.onHand} - ${inventory.reserved})`.mapWith(Number),
      })
      .from(productVariants)
      .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(and(eq(productVariants.productId, product.id), eq(productVariants.status, "active"), isNull(productVariants.deletedAt)))
      .orderBy(asc(productVariants.sortOrder));
    const specs = await db
      .select()
      .from(productSpecs)
      .where(eq(productSpecs.productId, product.id))
      .orderBy(asc(productSpecs.sortOrder));
    const fallback = variantRows.find((variant) => variant.isDefault) ?? variantRows[0];
    if (!fallback || !category) return null;
    const galleryRows = await db
      .select({ id: productImages.id, url: productImages.url, alt: productImages.alt, isPrimary: productImages.isPrimary })
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
    const primaryImage = galleryRows.find((image) => image.isPrimary) ?? galleryRows[0];
    const card = toCard({
      id: product.id,
      slug: product.slug,
      name: product.name,
      englishName: product.englishName,
      subtitle: product.subtitle,
      homepageTitle: product.homepageTitle,
      homepageSubtitle: product.homepageSubtitle,
      isOrganic: product.isOrganic,
      isBestSeller: product.isBestSeller,
      isFeatured: product.isFeatured,
      featuredOrder: product.featuredOrder,
      catalogOrder: product.catalogOrder,
      categorySlug: category.slug,
      categoryName: category.name,
      iconType: category.iconType,
      variantId: fallback.id,
      variantLabel: fallback.label,
      priceIrr: fallback.priceIrr,
      compareAtPriceIrr: fallback.compareAtPriceIrr,
      onHand: fallback.onHand,
      imageUrl: primaryImage?.url ?? "",
    });
    const variants: VariantChoice[] = variantRows.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      label: variant.label,
      unitKind: variant.unitKind,
      amount: variant.amount,
      priceIrr: variant.priceIrr,
      compareAtPriceIrr: variant.compareAtPriceIrr,
      onHand: variant.onHand,
      isDefault: variant.isDefault,
    }));
    return {
      ...card,
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      origin: product.origin,
      ingredients: product.ingredients,
      usageInstructions: product.usageInstructions,
      storageInstructions: product.storageInstructions,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      specs: specs.map((spec) => ({ label: spec.label, text: spec.value })),
      gallery: galleryRows,
      variants,
      oilFinder: product.oilFinder,
    };
  });

export const getPage = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }): Promise<SitePage | null> => {
    const db = await readyDb();
    const [page] = await db
      .select()
      .from(sitePages)
      .where(and(eq(sitePages.slug, data.slug), eq(sitePages.isPublished, true)))
      .limit(1);
    if (!page) return null;
    return {
      slug: page.slug,
      title: page.title,
      body: page.body,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      origin: requestOrigin(),
    };
  });

export const listArticles = createServerFn({ method: "GET" }).handler(async (): Promise<ArticleCard[]> => {
  const db = await readyDb();
  const rows = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      authorName: articles.authorName,
      readMinutes: articles.readMinutes,
      categoryName: articleCategories.name,
    })
    .from(articles)
    .leftJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
    .where(and(eq(articles.status, "published"), isNull(articles.deletedAt)))
    .orderBy(desc(articles.publishedAt));
  return rows.map((row) => ({ ...row, categoryName: row.categoryName ?? "" }));
});

export const getArticle = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1).max(140) }).parse(input))
  .handler(async ({ data }): Promise<ArticleDetail | null> => {
    const db = await readyDb();
    const [article] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, data.slug), isNull(articles.deletedAt)))
      .limit(1);
    if (!article || article.status !== "published") return null;
    const [category] = article.categoryId
      ? await db.select().from(articleCategories).where(eq(articleCategories.id, article.categoryId)).limit(1)
      : [];
    const [cover] = article.coverMediaId
      ? await db
          .select()
          .from(mediaAssets)
          .where(and(eq(mediaAssets.id, article.coverMediaId), isNull(mediaAssets.deletedAt)))
          .limit(1)
      : [];
    const relatedIds = await db
      .select({ productId: articleProducts.productId })
      .from(articleProducts)
      .where(eq(articleProducts.articleId, article.id));
    const cards = await loadCards();
    const idSet = new Set(relatedIds.map((row) => row.productId));
    return {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      categoryName: category?.name ?? "",
      authorName: article.authorName,
      readMinutes: article.readMinutes,
      content: article.content,
      coverUrl: cover && isRenderableMediaUrl(cover.publicUrl) ? cover.publicUrl : null,
      coverAlt: cover && isRenderableMediaUrl(cover.publicUrl) ? cover.alt : null,
      related: cards.filter((card) => idSet.has(card.id)),
    };
  });

export async function quoteCartWithDb(
  db: Awaited<ReturnType<typeof getDb>>,
  data: z.infer<typeof cartSchema>,
) {
    const lines = [];
    for (const item of data.items) {
      const [row] = await db
        .select({
          variantId: productVariants.id,
          label: productVariants.label,
          priceIrr: productVariants.priceIrr,
          compareAtPriceIrr: productVariants.compareAtPriceIrr,
          sku: productVariants.sku,
          onHand: sql<number>`(${inventory.onHand} - ${inventory.reserved})`.mapWith(Number),
          productId: products.id,
          slug: products.slug,
          name: products.name,
          iconType: productCategories.iconType,
          productStatus: products.status,
          productDeletedAt: products.deletedAt,
          variantStatus: productVariants.status,
          variantDeletedAt: productVariants.deletedAt,
          categoryActive: productCategories.isActive,
          categoryDeletedAt: productCategories.deletedAt,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
        .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
        .where(eq(productVariants.id, item.variantId))
        .limit(1);
      if (
        !row ||
        !isLineSellable({
          productStatus: row.productStatus,
          variantStatus: row.variantStatus,
          variantDeletedAt: row.variantDeletedAt,
          productDeletedAt: row.productDeletedAt,
          categoryActive: row.categoryActive,
          categoryDeletedAt: row.categoryDeletedAt,
          productFound: true,
        })
      )
        continue;
      const quantity = Math.min(item.quantity, Math.max(row.onHand, 0));
      if (quantity < 1) continue;
      lines.push({
        variantId: row.variantId,
        productId: row.productId,
        slug: row.slug,
        name: row.name,
        label: row.label,
        sku: row.sku,
        iconType: row.iconType,
        quantity,
        unitPriceIrr: row.priceIrr,
        compareAtPriceIrr: row.compareAtPriceIrr,
        lineTotalIrr: row.priceIrr * quantity,
        onHand: row.onHand,
      });
    }
    const subtotalIrr = lines.reduce((sum, line) => sum + line.lineTotalIrr, 0);
    return { lines, subtotalIrr };
}

export const quoteCart = createServerFn({ method: "POST" })
  .validator((input: unknown) => cartSchema.parse(input))
  .handler(async ({ data }) => quoteCartWithDb(await readyDb(), data));

export const listOilProducts = createServerFn({ method: "GET" }).handler(async () => {
  const db = await readyDb();
  const rows = await db
    .select({
      slug: products.slug,
      name: products.name,
      subtitle: products.subtitle,
      oilFinder: products.oilFinder,
      priceIrr: productVariants.priceIrr,
    })
    .from(products)
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .innerJoin(
      productVariants,
      and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)),
    )
    .where(
      and(
        eq(productCategories.slug, "oils"),
        eq(productCategories.isActive, true),
        isNull(productCategories.deletedAt),
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(productVariants.status, "active"),
      ),
    );
  return rows.filter((row) => row.oilFinder);
});

export type { StoreProfile, BrandLogos, FooterColumn };
