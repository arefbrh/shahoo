import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../db/schema.ts";
import { auditLogs, articleCategories, articles, banners, contentRevisions, homepageSections, mediaAssets, navigationItems, navigationMenus, productCategories, productImages, products, settings, sitePages } from "../db/schema.ts";
import {
  applyArticleSave,
  applyBannerSave,
  applyNavSave,
  applyPageUpdate,
  loadContentHistory,
  restoreContentRevision,
  applySectionOrder,
  applySectionUpdate,
  applySiteCopy,
  applyStoreLayout,
  registerExternalMedia,
  retireMedia,
} from "./content.ts";
import { attachMediaToProduct, detachProductImage, reorderProductImages } from "../media/storage.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function database() {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(readFileSync(join(root, "migrations/0002_shahoo_foundation.sql"), "utf8"));
  await pg.exec(readFileSync(join(root, "migrations/0017_content_revisions.sql"), "utf8"));
  const db = drizzle(pg, { schema });
  await db.insert(homepageSections).values([
    { id: "sec-a", sectionType: "hero", title: "خانه", sortOrder: 1, isActive: true },
    { id: "sec-b", sectionType: "newsletter", title: "خبر", sortOrder: 2, isActive: true },
  ]);
  await db.insert(navigationMenus).values({ id: "menu-header", key: "header", name: "منوی اصلی" });
  await db.insert(navigationItems).values([
    { id: "nav-a", menuId: "menu-header", label: "خانه", href: "/", sortOrder: 1, isActive: true },
    { id: "nav-b", menuId: "menu-header", label: "فروشگاه", href: "/products", sortOrder: 2, isActive: true },
  ]);
  await db.insert(banners).values({
    id: "slide-1",
    placement: "home-hero",
    title: "محصولات طبیعی شاهو",
    ctaLabel: "مشاهده",
    ctaHref: "/products",
    sortOrder: 1,
  });
  await db.insert(articleCategories).values({ id: "oils-journal", slug: "oils-journal", name: "روغن‌ها", sortOrder: 1 });
  await db.insert(settings).values([
    { key: "store.story", value: { title: "قدیم", about: "متن معرفی قبلی برای آزمون.", philosophy: "فلسفه قبلی آزمون است." } },
    { key: "header.promo", value: { text: "نوار قبلی" } },
    { key: "brand.logos", value: { header: "/assets/brand/shahoo-logo-minimal.png", footer: "/assets/brand/shahoo-logo-primary.png" } },
  ]);
  await db.insert(mediaAssets).values({
    id: "media-logo",
    filename: "shahoo-logo-primary.png",
    mimeType: "image/png",
    storageKey: "brand/primary",
    publicUrl: "/assets/brand/shahoo-logo-primary.png",
    alt: "لوگوی شاهو",
  });
  return db;
}

test("pages and articles keep immutable revisions and can restore a previous version", async () => {
  const db = await database();
  const pageCreated = await applyPageUpdate(db, "admin-a", {
    slug: "about-us", title: "درباره ما", body: "متن نسخه اول صفحه.",
    seoTitle: "", seoDescription: "", isPublished: false,
  });
  assert.equal(pageCreated.ok, true);
  const [page] = await db.select().from(sitePages).where(eq(sitePages.slug, "about-us"));
  assert.ok(page);
  const pageUpdated = await applyPageUpdate(db, "admin-a", {
    id: page!.id, slug: "about-us", title: "درباره شاهو", body: "متن نسخه دوم صفحه.",
    seoTitle: "", seoDescription: "", isPublished: true,
  });
  assert.equal(pageUpdated.ok, true);
  const pageHistory = await loadContentHistory(db, "page", page!.id);
  assert.deepEqual(pageHistory.map((item) => item.version), [2, 1]);
  const restoredPage = await restoreContentRevision(db, "admin-a", (await db.select().from(contentRevisions).where(eq(contentRevisions.entityId, page!.id)).orderBy(asc(contentRevisions.version)).limit(1))[0]!.id);
  assert.equal(restoredPage.ok, true);
  const [pageAfterRestore] = await db.select().from(sitePages).where(eq(sitePages.id, page!.id));
  assert.equal(pageAfterRestore?.title, "درباره ما");
  assert.equal(pageAfterRestore?.isPublished, false);
  assert.equal((await loadContentHistory(db, "page", page!.id)).length, 3);

  const articleCreated = await applyArticleSave(db, "admin-a", {
    slug: "olive-guide", title: "راهنمای روغن", excerpt: "خلاصه مقاله",
    seoTitle: "", seoDescription: "", content: "متن نسخه اول مقاله.",
    authorName: "کارگاه شاهو", readMinutes: 3, status: "draft",
    categoryId: "oils-journal", coverMediaId: null, relatedProductIds: [],
  });
  assert.equal(articleCreated.ok, true);
  const [article] = await db.select().from(articles).where(eq(articles.slug, "olive-guide"));
  assert.ok(article);
  const articleUpdated = await applyArticleSave(db, "admin-a", {
    id: article!.id, slug: "olive-guide", title: "راهنمای کامل روغن", excerpt: "خلاصه به‌روز",
    seoTitle: "", seoDescription: "", content: "متن نسخه دوم مقاله.",
    authorName: "کارگاه شاهو", readMinutes: 4, status: "published",
    categoryId: "oils-journal", coverMediaId: null, relatedProductIds: [],
  });
  assert.equal(articleUpdated.ok, true);
  const articleHistory = await loadContentHistory(db, "article", article!.id);
  assert.deepEqual(articleHistory.map((item) => item.version), [2, 1]);
  const oldArticleRevision = (await db.select().from(contentRevisions).where(eq(contentRevisions.entityId, article!.id)).orderBy(asc(contentRevisions.version)).limit(1))[0]!;
  const restoredArticle = await restoreContentRevision(db, "admin-a", oldArticleRevision.id);
  assert.equal(restoredArticle.ok, true);
  const [articleAfterRestore] = await db.select().from(articles).where(eq(articles.id, article!.id));
  assert.equal(articleAfterRestore?.title, "راهنمای روغن");
  assert.equal(articleAfterRestore?.status, "draft");
  assert.equal((await loadContentHistory(db, "article", article!.id)).length, 3);
  assert.equal((await db.select().from(auditLogs)).filter((row) => row.action.endsWith("_revision_restored")).length, 2);
});

test("reordering sections is audited and a partial list is refused", async () => {
  const db = await database();
  const moved = await applySectionOrder(db, "admin-a", ["sec-b", "sec-a"]);
  assert.equal(moved.ok, true);
  const rows = await db.select().from(homepageSections);
  assert.equal(rows.find((row) => row.id === "sec-b")?.sortOrder, 1);
  assert.equal(rows.find((row) => row.id === "sec-a")?.sortOrder, 2);
  const partial = await applySectionOrder(db, "admin-a", ["sec-a"]);
  assert.equal(partial.ok, false);
  assert.equal((await db.select().from(auditLogs)).length, 1);
});

test("the last active homepage section cannot be turned off", async () => {
  const db = await database();
  const first = await applySectionUpdate(db, "admin-a", { id: "sec-a", title: "خانه", subtitle: "", body: "", isActive: false, config: {} });
  const second = await applySectionUpdate(db, "admin-a", { id: "sec-b", title: "خبر", subtitle: "", body: "", isActive: false, config: {} });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  if (!second.ok) assert.match(second.message, /حداقل یک بخش فعال/);
  const left = await db.select().from(homepageSections);
  assert.equal(left.filter((row) => row.isActive).length, 1);
});

test("a script href does not change the banner or write an audit", async () => {
  const db = await database();
  const saved = await applyBannerSave(db, "admin-a", {
    id: "slide-1",
    title: "عنوان تازه",
    subtitle: "",
    body: "",
    ctaLabel: "مشاهده",
    ctaHref: "javascript:alert(1)",
    isActive: true,
    startsOn: "",
    endsOn: "",
  });
  assert.equal(saved.ok, false);
  const [banner] = await db.select().from(banners);
  assert.equal(banner?.title, "محصولات طبیعی شاهو");
  assert.equal((await db.select().from(auditLogs)).length, 0);
});

test("https media can be registered and retired, but a brand file and a linked file cannot", async () => {
  const db = await database();
  const http = await registerExternalMedia(db, "admin-a", { url: "http://cdn.example/a.png", alt: "روغن" });
  assert.equal(http.ok, false);
  const saved = await registerExternalMedia(db, "admin-a", { url: "https://cdn.example/oils/sesame.png", alt: "روغن کنجد" });
  assert.equal(saved.ok, true);
  const [media] = await db.select().from(mediaAssets).where(eq(mediaAssets.publicUrl, "https://cdn.example/oils/sesame.png"));
  assert.equal(media?.storageKey.startsWith("external:"), true);
  assert.equal(media?.byteSize, 0);
  const brand = await retireMedia(db, "admin-a", "media-logo");
  assert.equal(brand.ok, false);
  if (!brand.ok) assert.match(brand.message, /رسمی برند/);
  await db.update(banners).set({ desktopMediaId: media?.id }).where(eq(banners.id, "slide-1"));
  const linked = await retireMedia(db, "admin-a", media?.id ?? "");
  assert.equal(linked.ok, false);
  await db.update(banners).set({ desktopMediaId: null }).where(eq(banners.id, "slide-1"));
  const retired = await retireMedia(db, "admin-a", media?.id ?? "");
  assert.equal(retired.ok, true);
});

test("store layout settings are validated, persisted and audited", async () => {
  const db = await database();
  const value = {
    stickyHeader: false,
    headerLogoHeight: 64,
    footerLogoHeight: 128,
    footerAlignment: "center" as const,
  };
  const saved = await applyStoreLayout(db, "admin-layout", value);
  assert.equal(saved.ok, true);
  const [row] = await db.select().from(settings).where(eq(settings.key, "store.layout"));
  assert.deepEqual(row?.value, value);
  const [audit] = await db.select().from(auditLogs);
  assert.equal(audit?.action, "store.layout_updated");

  const invalid = await applyStoreLayout(db, "admin-layout", { ...value, headerLogoHeight: 20 });
  assert.equal(invalid.ok, false);
  const [unchanged] = await db.select().from(settings).where(eq(settings.key, "store.layout"));
  assert.deepEqual(unchanged?.value, value);
  assert.equal((await db.select().from(auditLogs)).length, 1);
});

test("story copy does not rewrite the official logo settings", async () => {
  const db = await database();
  const saved = await applySiteCopy(db, "admin-a", {
    storyTitle: "چرا شاهو؟",
    storyAbout: "معرفی تازه کارگاه برای آزمون محتوا.",
    storyPhilosophy: "خلوص مهم‌تر از ادعای درمان است.",
    promo: "ارسال بالای یک و نیم میلیون",
  });
  assert.equal(saved.ok, true);
  const [logos] = await db.select().from(settings).where(eq(settings.key, "brand.logos"));
  assert.deepEqual(logos?.value, {
    header: "/assets/brand/shahoo-logo-minimal.png",
    footer: "/assets/brand/shahoo-logo-primary.png",
  });
});

test("homepage section body and banner media ids persist", async () => {
  const db = await database();
  const section = await applySectionUpdate(db, "admin-a", {
    id: "sec-a",
    title: "خانه",
    subtitle: "زیرعنوان",
    body: "متن بدنه بخش برای نمایش عمومی.",
    isActive: true,
    config: {},
  });
  assert.equal(section.ok, true);
  const [row] = await db.select().from(homepageSections).where(eq(homepageSections.id, "sec-a"));
  assert.equal(row?.body, "متن بدنه بخش برای نمایش عمومی.");
  const registered = await registerExternalMedia(db, "admin-a", { url: "https://cdn.example/oils/hero.png", alt: "اسلاید شاهو" });
  assert.equal(registered.ok, true);
  const [media] = await db.select().from(mediaAssets).where(eq(mediaAssets.publicUrl, "https://cdn.example/oils/hero.png"));
  const banner = await applyBannerSave(db, "admin-a", {
    id: "slide-1",
    title: "عنوان تازه",
    subtitle: "",
    body: "متن اسلاید",
    ctaLabel: "مشاهده",
    ctaHref: "/products",
    isActive: true,
    startsOn: "",
    endsOn: "",
    desktopMediaId: media?.id ?? "missing",
    mobileMediaId: null,
  });
  assert.equal(banner.ok, true);
  const [saved] = await db.select().from(banners).where(eq(banners.id, "slide-1"));
  assert.equal(saved?.desktopMediaId, media?.id);
  assert.equal(saved?.mobileMediaId, null);
  assert.equal(saved?.body, "متن اسلاید");
  const missing = await applyBannerSave(db, "admin-a", {
    id: "slide-1",
    title: "نباید عوض شود",
    subtitle: "",
    body: "",
    ctaLabel: "مشاهده",
    ctaHref: "/products",
    isActive: true,
    startsOn: "",
    endsOn: "",
    desktopMediaId: "med-missing",
  });
  assert.equal(missing.ok, false);
  const [unchanged] = await db.select().from(banners).where(eq(banners.id, "slide-1"));
  assert.equal(unchanged?.title, "عنوان تازه");
  assert.equal(unchanged?.desktopMediaId, media?.id);
});

test("the last active menu link and a duplicate article slug are refused", async () => {
  const db = await database();
  await applyNavSave(db, "admin-a", { id: "nav-b", menuKey: "header", label: "فروشگاه", href: "/products", isActive: false });
  const last = await applyNavSave(db, "admin-a", { id: "nav-a", menuKey: "header", label: "خانه", href: "/", isActive: false });
  assert.equal(last.ok, false);
  const article = {
    slug: "sesame-note",
    title: "یادداشت کنجد",
    excerpt: "خلاصه‌ای کوتاه از روغن.",
    seoTitle: "یادداشت سئو کنجد",
    seoDescription: "توضیح سئوی کوتاه و اختصاصی.",
    content: "متن مقاله برای انتشار.",
    authorName: "کارگاه شاهو",
    readMinutes: 4,
    status: "published" as const,
    categoryId: "oils-journal",
    coverMediaId: null,
    relatedProductIds: [],
  };
  assert.equal((await applyArticleSave(db, "admin-a", article)).ok, true);
  const again = await applyArticleSave(db, "admin-a", { ...article, title: "عنوان دیگر" });
  assert.equal(again.ok, false);
  const rows = await db.select().from(articles);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.seoTitle, "یادداشت سئو کنجد");
  assert.equal(rows[0]?.seoDescription, "توضیح سئوی کوتاه و اختصاصی.");
  assert.ok(rows[0]?.publishedAt);
  assert.equal((await applyArticleSave(db, "admin-a", { ...article, seoTitle: "<script>" })).ok, false);
});

test("new CMS pages can be created and existing route slugs stay fixed", async () => {
  const db = await database();
  const created = await applyPageUpdate(db, "admin-a", {
    slug: "owner-story",
    title: "داستان کارگاه",
    body: "این متن نمونه فقط در آزمون ذخیره می‌شود.",
    seoTitle: "داستان شاهو",
    seoDescription: "شرح کوتاه صفحه داستان.",
    isPublished: false,
  });
  assert.equal(created.ok, true);
  const [page] = await db.select().from(sitePages).where(eq(sitePages.slug, "owner-story"));
  assert.equal(page?.isPublished, false);
  assert.equal(page?.seoTitle, "داستان شاهو");
  const changedSlug = await applyPageUpdate(db, "admin-a", {
    id: page?.id,
    slug: "renamed-story",
    title: "عنوان",
    body: "متن صفحه برای آزمون.",
    seoTitle: "",
    seoDescription: "",
    isPublished: true,
  });
  assert.equal(changedSlug.ok, false);
});

test("product image order is an exact, audited permutation", async () => {
  const db = await database();
  await db.insert(productCategories).values({ id: "cat-a", slug: "cat-a", name: "دسته", shortName: "دسته" });
  await db.insert(products).values({ id: "prod-a", categoryId: "cat-a", slug: "prod-a", sku: "PROD-A", name: "محصول" });
  await db.insert(productImages).values([
    { id: "img-a", productId: "prod-a", url: "https://cdn.example/a.jpg", alt: "تصویر الف", sortOrder: 1, isPrimary: true },
    { id: "img-b", productId: "prod-a", url: "https://cdn.example/b.jpg", alt: "تصویر ب", sortOrder: 2, isPrimary: false },
  ]);
  const saved = await reorderProductImages(db, "admin-a", "prod-a", ["img-b", "img-a"]);
  assert.equal(saved.ok, true);
  const ordered = await db.select().from(productImages).orderBy(productImages.sortOrder);
  assert.deepEqual(ordered.map((image) => image.id), ["img-b", "img-a"]);
  const invalid = await reorderProductImages(db, "admin-a", "prod-a", ["img-a"]);
  assert.equal(invalid.ok, false);
  assert.equal((await db.select().from(auditLogs)).length, 1);
});

test("detaching a product image removes only the association, not shared media", async () => {
  const db = await database();
  await db.insert(productCategories).values({ id: "cat-media", slug: "cat-media", name: "دسته", shortName: "دسته" });
  await db.insert(products).values([
    { id: "prod-media-a", categoryId: "cat-media", slug: "prod-media-a", sku: "PROD-MEDIA-A", name: "محصول الف" },
    { id: "prod-media-b", categoryId: "cat-media", slug: "prod-media-b", sku: "PROD-MEDIA-B", name: "محصول ب" },
  ]);
  assert.equal((await registerExternalMedia(db, "admin-a", { url: "https://cdn.example/shared.png", alt: "تصویر مشترک" })).ok, true);
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.publicUrl, "https://cdn.example/shared.png"));
  assert.ok(asset);
  assert.equal((await attachMediaToProduct(db, "admin-a", "prod-media-a", asset.id, true)).ok, true);
  assert.equal((await attachMediaToProduct(db, "admin-a", "prod-media-b", asset.id, false)).ok, true);
  const [association] = await db.select().from(productImages).where(eq(productImages.productId, "prod-media-b"));
  assert.ok(association);
  assert.equal((await detachProductImage(db, "admin-a", association.id)).ok, true);
  assert.equal((await db.select().from(productImages).where(eq(productImages.mediaId, asset.id))).length, 1);
  assert.equal((await db.select().from(mediaAssets).where(eq(mediaAssets.id, asset.id))).length, 1);
});

test("content writes require the content permission at the server function", () => {
  const source = readFileSync(join(root, "src/server/cms/api.ts"), "utf8");
  assert.match(source, /requireAdmin\("content\.write"\)/);
  assert.doesNotMatch(source, /STORAGE_|ZARINPAL|passwordHash/);
  const mediaDesk = readFileSync(join(root, "src/components/site/content-desk.tsx"), "utf8");
  assert.match(mediaDesk, /desk\.uploadEnabled/);
  assert.match(mediaDesk, /type="file"/);
  assert.match(mediaDesk, /uploadMedia\(/);
  assert.match(mediaDesk, /ثبت نشانی تصویر HTTPS/);
  const storefront = readFileSync(join(root, "src/server/storefront/api.ts"), "utf8");
  assert.match(storefront, /article\.status !== "published"/);
  assert.match(storefront, /eq\(articles\.status, "published"\)/);
});

test("concurrent section orders stay a complete permutation", async () => {
  const db = await database();
  const results = await Promise.all([
    applySectionOrder(db, "admin-a", ["sec-b", "sec-a"]),
    applySectionOrder(db, "admin-b", ["sec-a", "sec-b"]),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 2);
  const rows = await db.select().from(homepageSections);
  const orders = rows.map((row) => row.sortOrder).sort();
  assert.deepEqual(orders, [1, 2]);
});
