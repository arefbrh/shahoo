import { createHash } from "node:crypto";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { tehranDayKey } from "../../lib/tehran-time.ts";
import type {
  ArticleDraft,
  BannerDraft,
  BrandSettingsDraft,
  CmsDesk,
  CmsResult,
  CopyDraft,
  NavDraft,
  PageDraft,
  ProfileDraft,
  SectionConfigDraft,
  SectionDraft,
  StoreLayoutDraft,
  FaqItemDraft,
  TrustMarkDraft,
} from "../../lib/cms-types.ts";
import {
  cleanBody,
  cleanInline,
  filenameFromUrl,
  imageMimeFromUrl,
  isMenuKey,
  isOfficialBrandAsset,
  isSectionType,
  normalizeSectionConfig,
  parseExternalMediaUrl,
  parsePublicHref,
  parseSchedule,
  parseSlug,
  permutationOrder,
} from "../../lib/cms-rules.ts";
import { parseProfileContact } from "../../lib/public-profile.ts";
import { writeAudit } from "../auth/audit.ts";
import { objectNameForStorageKey, openStorage } from "../media/disk.ts";
import { lockLiveMediaAsset, mediaInUse, removeFileOrRecord, retryPendingMediaCleanup } from "../media/lock.ts";
import * as schema from "../db/schema.ts";
import {
  articleCategories,
  articleProducts,
  articles,
  contentRevisions,
  banners,
  homepageSections,
  mediaAssets,
  navigationItems,
  navigationMenus,
  products,
  settings,
  sitePages,
} from "../db/schema.ts";

type Database = PgliteDatabase<typeof schema>;

const ORDER_GAP = "فهرست ترتیب کامل نیست.";

function readConfig(value: unknown): SectionConfigDraft {
  if (!value || typeof value !== "object") return {};
  const record = value as SectionConfigDraft;
  const flags = Array.isArray(record.flags)
    ? record.flags.filter((flag) => flag === "featured" || flag === "best" || flag === "offer" || flag === "newest")
    : undefined;
  const items = Array.isArray(record.items)
    ? record.items.filter((item) => item && typeof item.title === "string" && typeof item.text === "string")
    : undefined;
  return {
    limit: typeof record.limit === "number" ? record.limit : undefined,
    flags,
    items,
  };
}

function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    parts.push(current.message);
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return parts.join(" ");
}

async function transactionResult(
  db: Database,
  run: (tx: Database, deny: (message: string) => never) => Promise<void>,
): Promise<CmsResult> {
  let blocked = "";
  try {
    await db.transaction(async (tx) => {
      const deny = (message: string): never => {
        blocked = message;
        throw new Error(message);
      };
      await run(tx, deny);
    });
  } catch (error) {
    if (blocked) return { ok: false, message: blocked };
    const text = errorText(error);
    if (text.includes("duplicate key") || text.includes("23505")) {
      return { ok: false, message: "این مقدار یکتا قبلاً ثبت شده است." };
    }
    throw error;
  }
  return { ok: true };
}

async function lockTable(tx: Database, table: "homepage_sections" | "banners"): Promise<void> {
  if (table === "homepage_sections") await tx.execute(sql`select id from homepage_sections for update`);
  else await tx.execute(sql`select id from banners for update`);
}

export type CmsContentPreview =
  | { kind: "page"; title: string; body: string; slug: string; status: "draft" | "published"; seoTitle: string; seoDescription: string }
  | { kind: "article"; title: string; body: string; slug: string; status: "draft" | "published"; excerpt: string; authorName: string; readMinutes: number; categoryName: string; coverUrl: string | null; coverAlt: string };

export async function loadContentPreview(db: Database, entityType: "page" | "article", entityId: string): Promise<CmsContentPreview | null> {
  if (entityType === "page") {
    const [page] = await db.select().from(sitePages).where(eq(sitePages.id, entityId)).limit(1);
    if (!page) return null;
    return {
      kind: "page",
      title: page.title,
      body: page.body,
      slug: page.slug,
      status: page.isPublished ? "published" : "draft",
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
    };
  }
  const [article] = await db.select().from(articles)
    .where(and(eq(articles.id, entityId), isNull(articles.deletedAt)))
    .limit(1);
  if (!article) return null;
  const [category] = article.categoryId
    ? await db.select({ name: articleCategories.name }).from(articleCategories).where(eq(articleCategories.id, article.categoryId)).limit(1)
    : [];
  const [cover] = article.coverMediaId
    ? await db.select({ publicUrl: mediaAssets.publicUrl, alt: mediaAssets.alt })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, article.coverMediaId), isNull(mediaAssets.deletedAt)))
      .limit(1)
    : [];
  return {
    kind: "article",
    title: article.title,
    body: article.content,
    slug: article.slug,
    status: article.status === "published" ? "published" : "draft",
    excerpt: article.excerpt,
    authorName: article.authorName,
    readMinutes: article.readMinutes,
    categoryName: category?.name ?? "",
    coverUrl: cover?.publicUrl ?? null,
    coverAlt: cover?.alt ?? "",
  };
}

export { DEFAULT_PRODUCT_FAQS, DEFAULT_TRUST_MARKS } from "../../lib/cms-defaults.ts";

export async function loadCmsDesk(db: Database): Promise<CmsDesk> {
  const [sectionRows, bannerRows, menuRows, itemRows, pageRows, articleRows, categoryRows, productRows, mediaRows, settingRows, links] =
    await Promise.all([
      db.select().from(homepageSections).orderBy(asc(homepageSections.sortOrder)),
      db.select().from(banners).where(eq(banners.placement, "home-hero")).orderBy(asc(banners.sortOrder)),
      db.select().from(navigationMenus),
      db.select().from(navigationItems).orderBy(asc(navigationItems.sortOrder)),
      db.select().from(sitePages).orderBy(asc(sitePages.slug)),
      db.select().from(articles).where(isNull(articles.deletedAt)).orderBy(desc(articles.updatedAt)).limit(100),
      db.select().from(articleCategories).orderBy(asc(articleCategories.sortOrder)),
      db.select({ id: products.id, name: products.name }).from(products).where(isNull(products.deletedAt)).orderBy(asc(products.name)),
      db.select().from(mediaAssets).where(isNull(mediaAssets.deletedAt)).orderBy(desc(mediaAssets.createdAt)).limit(100),
      db.select().from(settings),
      db.select().from(articleProducts),
    ]);
  const settingsMap = new Map(settingRows.map((row) => [row.key, row.value]));
  const story = (settingsMap.get("store.story") ?? {}) as { title?: string; about?: string; philosophy?: string };
  const promo = (settingsMap.get("header.promo") ?? {}) as { text?: string };
  const profile = (settingsMap.get("store.profile") ?? {}) as {
    brandName?: string;
    tagline?: string;
    copyright?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
    instagram?: string;
    telegram?: string;
  };
  const related = new Map<string, string[]>();
  for (const link of links) {
    const list = related.get(link.articleId) ?? [];
    list.push(link.productId);
    related.set(link.articleId, list);
  }
  const menus = menuRows
    .filter((menu) => isMenuKey(menu.key))
    .map((menu) => ({
      key: menu.key,
      name: menu.name,
      items: itemRows
        .filter((item) => item.menuId === menu.id)
        .map((item) => ({
          id: item.id,
          label: item.label,
          href: item.href,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
        })),
    }));
  return {
    uploadEnabled: openStorage() !== null,
    brandName: profile.brandName ?? "",
    tagline: profile.tagline ?? "",
    copyright: profile.copyright ?? "",
    logos: (() => {
      const value = settingsMap.get("brand.logos");
      const logos = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        header: typeof logos.header === "string" ? logos.header : "",
        footer: typeof logos.footer === "string" ? logos.footer : "",
      };
    })(),
    layout: (() => {
      const value = settingsMap.get("store.layout");
      const config = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const clamp = (n: unknown, fallback: number, min: number, max: number) => typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
      return {
        stickyHeader: config.stickyHeader !== false,
        headerLogoHeight: clamp(config.headerLogoHeight, 56, 40, 80),
        footerLogoHeight: clamp(config.footerLogoHeight, 112, 64, 144),
        footerAlignment: config.footerAlignment === "center" ? "center" as const : "start" as const,
      };
    })(),
    carousel: (() => {
      const value = settingsMap.get("home.carousel");
      const config = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const interval = typeof config.intervalMs === "number" ? config.intervalMs : 6500;
      return { autoPlay: config.autoPlay !== false, intervalMs: Math.min(15000, Math.max(3000, interval)) };
    })(),
    storyTitle: story.title ?? "",
    storyAbout: story.about ?? "",
    storyPhilosophy: story.philosophy ?? "",
    promo: promo.text ?? "",
    phone: profile.phone ?? "",
    whatsapp: profile.whatsapp ?? "",
    email: profile.email ?? "",
    address: profile.address ?? "",
    instagram: profile.instagram ?? "",
    telegram: profile.telegram ?? "",
    sections: sectionRows.map((row) => ({
      id: row.id,
      sectionType: row.sectionType,
      title: row.title,
      subtitle: row.subtitle,
      body: row.body,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      config: readConfig(row.config),
    })),
    banners: bannerRows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      body: row.body,
      ctaLabel: row.ctaLabel,
      ctaHref: row.ctaHref,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      startsOn: row.startsAt ? tehranDayKey(row.startsAt) : "",
      endsOn: row.endsAt ? tehranDayKey(row.endsAt) : "",
      desktopMediaId: row.desktopMediaId,
      mobileMediaId: row.mobileMediaId,
    })),
    menus,
    pages: pageRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      body: row.body,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      isPublished: row.isPublished,
    })),
    articles: articleRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      content: row.content,
      authorName: row.authorName,
      readMinutes: row.readMinutes,
      status: row.status === "published" ? "published" : "draft",
      categoryId: row.categoryId ?? "",
      coverMediaId: row.coverMediaId,
      relatedProductIds: related.get(row.id) ?? [],
    })),
    articleCategories: categoryRows.map((row) => ({ id: row.id, name: row.name })),
    products: productRows,
    media: mediaRows.map((row) => ({
      id: row.id,
      filename: row.filename,
      alt: row.alt,
      publicUrl: row.publicUrl,
      mimeType: row.mimeType,
      official: isOfficialBrandAsset(row.publicUrl),
    })),
    faqs: (() => {
      const raw = settingsMap.get("store.product_faqs");
      if (Array.isArray(raw) && raw.length > 0) {
        return raw as FaqItemDraft[];
      }
      return DEFAULT_PRODUCT_FAQS;
    })(),
    trustMarks: (() => {
      const raw = settingsMap.get("store.trust_marks");
      if (Array.isArray(raw) && raw.length > 0) {
        return raw as TrustMarkDraft[];
      }
      return DEFAULT_TRUST_MARKS;
    })(),
  };
}

export async function applySiteCopy(db: Database, actorId: string, input: CopyDraft): Promise<CmsResult> {
  const storyTitle = cleanInline(input.storyTitle, 2, 80);
  const storyAbout = cleanBody(input.storyAbout, 2, 2000);
  const storyPhilosophy = cleanBody(input.storyPhilosophy, 2, 2000);
  const promo = cleanInline(input.promo, 2, 180);
  if (!storyTitle || !storyAbout || !storyPhilosophy || !promo) {
    return { ok: false, message: "عنوان، معرفی، فلسفه و نوار بالای سایت باید متن امن و کوتاه باشند." };
  }
  return transactionResult(db, async (tx, deny) => {
    await tx.execute(sql`select key from settings where key in ('store.story', 'header.promo', 'brand.logos') for update`);
    const rows = await tx
      .select()
      .from(settings)
      .where(or(eq(settings.key, "store.story"), eq(settings.key, "header.promo"), eq(settings.key, "brand.logos")));
    if (!rows.some((row) => row.key === "store.story") || !rows.some((row) => row.key === "header.promo")) {
      deny("متن معرفی فروشگاه پیدا نشد.");
    }
    await tx
      .update(settings)
      .set({ value: { title: storyTitle, about: storyAbout, philosophy: storyPhilosophy }, updatedAt: new Date() })
      .where(eq(settings.key, "store.story"));
    await tx.update(settings).set({ value: { text: promo }, updatedAt: new Date() }).where(eq(settings.key, "header.promo"));
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "content.copy_updated",
      entityType: "settings",
      entityId: "store.story",
    });
  });
}

export async function applyCarouselSettings(db: Database, actorId: string, input: { autoPlay: boolean; intervalMs: number }): Promise<CmsResult> {
  if (!Number.isInteger(input.intervalMs) || input.intervalMs < 3000 || input.intervalMs > 15000) {
    return { ok: false, message: "فاصله نمایش باید بین ۳۰۰۰ تا ۱۵۰۰۰ میلی‌ثانیه باشد." };
  }
  return transactionResult(db, async (tx) => {
    const [row] = await tx.select().from(settings).where(eq(settings.key, "home.carousel")).for("update");
    const value = { autoPlay: input.autoPlay, intervalMs: input.intervalMs };
    if (row) await tx.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, "home.carousel"));
    else await tx.insert(settings).values({ key: "home.carousel", value, updatedAt: new Date() });
    await writeAudit(tx, { actorType: "admin", actorId, action: "content.carousel_settings_updated", entityType: "settings", entityId: "home.carousel" });
  });
}

export async function applyStoreLayout(db: Database, actorId: string, input: StoreLayoutDraft): Promise<CmsResult> {
  if (typeof input.stickyHeader !== "boolean" || !Number.isInteger(input.headerLogoHeight) || input.headerLogoHeight < 40 || input.headerLogoHeight > 80 || !Number.isInteger(input.footerLogoHeight) || input.footerLogoHeight < 64 || input.footerLogoHeight > 144 || !["start", "center"].includes(input.footerAlignment)) {
    return { ok: false, message: "تنظیمات چیدمان معتبر نیست؛ اندازه لوگوی هدر باید ۴۰ تا ۸۰ و فوتر ۶۴ تا ۱۴۴ پیکسل باشد." };
  }
  return transactionResult(db, async (tx) => {
    const [row] = await tx.select().from(settings).where(eq(settings.key, "store.layout")).for("update");
    const value = { ...input };
    if (row) await tx.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, "store.layout"));
    else await tx.insert(settings).values({ key: "store.layout", value, updatedAt: new Date() });
    await writeAudit(tx, { actorType: "admin", actorId, action: "store.layout_updated", entityType: "settings", entityId: "store.layout" });
  });
}

export async function applyProductFaqs(db: Database, actorId: string, faqs: FaqItemDraft[]): Promise<CmsResult> {
  if (!Array.isArray(faqs)) {
    return { ok: false, message: "داده‌های پرسش و پاسخ معتبر نیست." };
  }
  for (const item of faqs) {
    if (!item.q || typeof item.q !== "string" || !item.q.trim()) {
      return { ok: false, message: "متن پرسش الزامی است." };
    }
    if (!item.a || typeof item.a !== "string" || !item.a.trim()) {
      return { ok: false, message: "متن پاسخ الزامی است." };
    }
  }

  return transactionResult(db, async (tx) => {
    const [row] = await tx.select().from(settings).where(eq(settings.key, "store.product_faqs")).for("update");
    if (row) {
      await tx.update(settings).set({ value: faqs, updatedAt: new Date() }).where(eq(settings.key, "store.product_faqs"));
    } else {
      await tx.insert(settings).values({ key: "store.product_faqs", value: faqs, updatedAt: new Date() });
    }
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "store.product_faqs_updated",
      entityType: "settings",
      entityId: "store.product_faqs",
      metadata: { count: faqs.length },
    });
  });
}

export async function applyTrustMarks(db: Database, actorId: string, marks: TrustMarkDraft[]): Promise<CmsResult> {
  if (!Array.isArray(marks)) {
    return { ok: false, message: "داده‌های نماد اعتماد معتبر نیست." };
  }
  for (const item of marks) {
    if (!item.title || typeof item.title !== "string" || !item.title.trim()) {
      return { ok: false, message: "عنوان نماد اعتماد الزامی است." };
    }
    if (item.verifyUrl && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(item.verifyUrl)) {
      return { ok: false, message: "آدرس تاییدیه نماد باید یک نشانی معتبر HTTPS باشد." };
    }
  }

  return transactionResult(db, async (tx) => {
    const [row] = await tx.select().from(settings).where(eq(settings.key, "store.trust_marks")).for("update");
    if (row) {
      await tx.update(settings).set({ value: marks, updatedAt: new Date() }).where(eq(settings.key, "store.trust_marks"));
    } else {
      await tx.insert(settings).values({ key: "store.trust_marks", value: marks, updatedAt: new Date() });
    }
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "store.trust_marks_updated",
      entityType: "settings",
      entityId: "store.trust_marks",
      metadata: { count: marks.length },
    });
  });
}

export async function applyBrandSettings(db: Database, actorId: string, input: BrandSettingsDraft): Promise<CmsResult> {
  const brandName = cleanInline(input.brandName, 2, 80);
  const tagline = cleanInline(input.tagline, 0, 180);
  const copyright = cleanInline(input.copyright, 0, 180);
  const parseLogo = (value: string): string | null => {
    const local = value.trim();
    if (/^\/assets\/brand\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp)$/i.test(local) && !local.includes("..")) return local;
    if (/^\/media\/file\/[A-Za-z0-9_-]{8,80}$/.test(local)) return local;
    return parseExternalMediaUrl(local);
  };
  const headerLogo = parseLogo(input.headerLogo);
  const footerLogo = parseLogo(input.footerLogo);
  if (!brandName || tagline === null || copyright === null || !headerLogo || !footerLogo) {
    return { ok: false, message: "نام برند، شعار، کپی‌رایت یا نشانی لوگو معتبر نیست. لوگو باید PNG، JPG یا WebP از مسیر رسانه برند یا HTTPS باشد." };
  }
  return transactionResult(db, async (tx, deny) => {
    const rows = await tx.select().from(settings).where(or(eq(settings.key, "store.profile"), eq(settings.key, "brand.logos")));
    const profileRow = rows.find((row) => row.key === "store.profile");
    const logosRow = rows.find((row) => row.key === "brand.logos");
    if (!profileRow || !logosRow) deny("تنظیمات برند پیدا نشد.");
    for (const logoUrl of [headerLogo, footerLogo]) {
      if (logoUrl.startsWith("/media/file/")) {
        const [asset] = await tx.select({ id: mediaAssets.id, mimeType: mediaAssets.mimeType }).from(mediaAssets)
          .where(and(eq(mediaAssets.publicUrl, logoUrl), isNull(mediaAssets.deletedAt))).limit(1);
        if (!asset || !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)) {
          deny("لوگوی انتخاب‌شده باید رسانه فعال PNG، JPG یا WebP در کتابخانه باشد.");
        }
      }
    }
    const profile = profileRow!.value && typeof profileRow!.value === "object" ? (profileRow!.value as Record<string, unknown>) : {};
    const logos = logosRow!.value && typeof logosRow!.value === "object" ? (logosRow!.value as Record<string, unknown>) : {};
    await tx.update(settings).set({ value: { ...profile, brandName, tagline, copyright }, updatedAt: new Date() }).where(eq(settings.key, "store.profile"));
    await tx.update(settings).set({
      value: { ...logos, header: headerLogo, footer: footerLogo, headerPng: headerLogo, footerPng: footerLogo },
      updatedAt: new Date(),
    }).where(eq(settings.key, "brand.logos"));
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "store.brand_settings_updated",
      entityType: "settings",
      entityId: "brand.logos",
    });
  });
}

export async function applyStoreProfile(db: Database, actorId: string, input: ProfileDraft): Promise<CmsResult> {
  const parsed = parseProfileContact(input);
  if (!parsed.ok) return parsed;
  return transactionResult(db, async (tx, deny) => {
    const [row] = await tx.select().from(settings).where(eq(settings.key, "store.profile")).limit(1);
    if (!row) {
      deny("اطلاعات فروشگاه پیدا نشد.");
      return;
    }
    const current = row.value && typeof row.value === "object" ? (row.value as Record<string, unknown>) : {};
    await tx
      .update(settings)
      .set({
        value: {
          brandName: typeof current.brandName === "string" ? current.brandName : "شاهو | SHAHOO",
          tagline: typeof current.tagline === "string" ? current.tagline : "",
          copyright: typeof current.copyright === "string" ? current.copyright : "",
          phone: parsed.value.phone,
          whatsapp: parsed.value.whatsapp,
          email: parsed.value.email,
          address: parsed.value.address,
          instagram: parsed.value.instagram,
          telegram: parsed.value.telegram,
        },
        updatedAt: new Date(),
      })
      .where(eq(settings.key, "store.profile"));
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "store.profile_updated",
      entityType: "settings",
      entityId: "store.profile",
    });
  });
}

export async function applySectionUpdate(db: Database, actorId: string, input: SectionDraft): Promise<CmsResult> {
  return transactionResult(db, async (tx, deny) => {
    await lockTable(tx, "homepage_sections");
    const [row] = await tx.select().from(homepageSections).where(eq(homepageSections.id, input.id));
    if (!row || !isSectionType(row.sectionType)) deny("بخش صفحه اول پیدا نشد.");
    const title = cleanInline(input.title, 0, 120) ?? "";
    const subtitle = cleanInline(input.subtitle, 0, 180);
    const body = cleanBody(input.body, 0, 2000);
    if (subtitle === null || body === null || (input.title.trim() && title === "")) {
      deny("متن بخش معتبر نیست.");
      return;
    }
    const config = normalizeSectionConfig(row.sectionType, input.config);
    if (!config.ok) {
      deny(config.message);
      return;
    }
    if (!input.isActive) {
      const active = await tx.select({ id: homepageSections.id }).from(homepageSections).where(eq(homepageSections.isActive, true));
      if (row.isActive && active.length <= 1) {
        deny("حداقل یک بخش فعال باید بماند.");
        return;
      }
    }
    await tx
      .update(homepageSections)
      .set({
        title: input.title.trim() ? title : "",
        subtitle,
        body,
        isActive: input.isActive,
        config: config.config,
        updatedAt: new Date(),
      })
      .where(eq(homepageSections.id, row.id));
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "content.section_updated",
      entityType: "homepage_section",
      entityId: row.id,
      metadata: { active: input.isActive, type: row.sectionType },
    });
  });
}

export async function applySectionOrder(db: Database, actorId: string, ids: string[]): Promise<CmsResult> {
  return transactionResult(db, async (tx, deny) => {
    await lockTable(tx, "homepage_sections");
    const rows = await tx.select({ id: homepageSections.id }).from(homepageSections);
    const order = permutationOrder(rows.map((row) => row.id), ids);
    if (!order) {
      deny(ORDER_GAP);
      return;
    }
    for (let index = 0; index < order.length; index += 1) {
      await tx
        .update(homepageSections)
        .set({ sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(homepageSections.id, order[index]));
    }
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "content.sections_reordered",
      entityType: "homepage_section",
      entityId: order[0],
      metadata: { count: order.length },
    });
  });
}

export async function applyBannerSave(db: Database, actorId: string, input: BannerDraft): Promise<CmsResult> {
  const title = cleanInline(input.title, 2, 120);
  const subtitle = cleanInline(input.subtitle, 0, 180);
  const body = cleanBody(input.body, 0, 500);
  const ctaLabel = cleanInline(input.ctaLabel, 2, 40);
  const ctaHref = parsePublicHref(input.ctaHref);
  const schedule = parseSchedule(input.startsOn, input.endsOn);
  if (!title || subtitle === null || body === null || !ctaLabel || !ctaHref || !schedule.ok) {
    return { ok: false, message: !schedule.ok ? schedule.message : "عنوان، دکمه و نشانی بنر لازم است." };
  }
  return transactionResult(db, async (tx, deny) => {
    await lockTable(tx, "banners");
    const desktopMediaId = await bannerMediaId(tx, input.desktopMediaId, deny, "دسکتاپ");
    const mobileMediaId = await bannerMediaId(tx, input.mobileMediaId, deny, "موبایل");
    if (!input.id) {
      const existing = await tx.select({ id: banners.id }).from(banners).where(eq(banners.placement, "home-hero"));
      if (existing.length >= 8) deny("بیش از ۸ اسلاید برای صفحه اول پذیرفته نمی‌شود.");
      const id = `ban-${crypto.randomUUID()}`;
      await tx.insert(banners).values({
        id,
        placement: "home-hero",
        title,
        subtitle,
        body,
        ctaLabel,
        ctaHref,
        desktopMediaId: desktopMediaId ?? null,
        mobileMediaId: mobileMediaId ?? null,
        isActive: input.isActive,
        sortOrder: existing.length + 1,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
      });
      await writeAudit(tx, { actorType: "admin", actorId, action: "content.banner_saved", entityType: "banner", entityId: id });
      return;
    }
    const [row] = await tx.select().from(banners).where(eq(banners.id, input.id));
    if (!row || row.placement !== "home-hero") deny("بنر پیدا نشد.");
    await tx
      .update(banners)
      .set({
        title,
        subtitle,
        body,
        ctaLabel,
        ctaHref,
        isActive: input.isActive,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        ...(desktopMediaId !== undefined ? { desktopMediaId } : {}),
        ...(mobileMediaId !== undefined ? { mobileMediaId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(banners.id, row.id));
    await writeAudit(tx, { actorType: "admin", actorId, action: "content.banner_saved", entityType: "banner", entityId: row.id });
  });
}

async function bannerMediaId(
  tx: Database,
  id: string | null | undefined,
  deny: (message: string) => never,
  side: string,
): Promise<string | null | undefined> {
  if (id === undefined) return undefined;
  if (!id) return null;
  const media = await lockLiveMediaAsset(tx, id);
  if (!media) deny(`تصویر ${side} در کتابخانه رسانه نیست.`);
  return media.id;
}

export async function applyBannerOrder(db: Database, actorId: string, ids: string[]): Promise<CmsResult> {
  return transactionResult(db, async (tx, deny) => {
    await lockTable(tx, "banners");
    const rows = await tx.select({ id: banners.id }).from(banners).where(eq(banners.placement, "home-hero"));
    const order = permutationOrder(rows.map((row) => row.id), ids);
    if (!order) {
      deny(ORDER_GAP);
      return;
    }
    for (let index = 0; index < order.length; index += 1) {
      await tx.update(banners).set({ sortOrder: index + 1, updatedAt: new Date() }).where(eq(banners.id, order[index]));
    }
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "content.banners_reordered",
      entityType: "banner",
      entityId: order[0],
      metadata: { count: order.length },
    });
  });
}

export async function applyNavSave(db: Database, actorId: string, input: NavDraft): Promise<CmsResult> {
  if (!isMenuKey(input.menuKey)) return { ok: false, message: "منو شناخته نشد." };
  const label = cleanInline(input.label, 2, 40);
  const href = parsePublicHref(input.href);
  if (!label || !href) return { ok: false, message: "برچسب و نشانی پیوند معتبر نیست." };
  return transactionResult(db, async (tx, deny) => {
    const [menu] = await tx.select().from(navigationMenus).where(eq(navigationMenus.key, input.menuKey));
    if (!menu) deny("منو پیدا نشد.");
    await tx.execute(sql`select id from navigation_items where menu_id = ${menu.id} for update`);
    const items = await tx.select().from(navigationItems).where(eq(navigationItems.menuId, menu.id));
    if (input.id) {
      const row = items.find((item) => item.id === input.id);
      if (!row) {
        deny("پیوند پیدا نشد.");
        return;
      }
      const activeAfter = items.filter((item) => (item.id === row.id ? input.isActive : item.isActive)).length;
      if (activeAfter < 1) deny("حداقل یک پیوند فعال در این منو باید بماند.");
      await tx
        .update(navigationItems)
        .set({ label, href, isActive: input.isActive })
        .where(eq(navigationItems.id, row.id));
      await writeAudit(tx, { actorType: "admin", actorId, action: "content.nav_saved", entityType: "navigation_item", entityId: row.id });
      return;
    }
    if (items.length >= 12) deny("این منو بیش از ۱۲ پیوند نمی‌پذیرد.");
    if (items.filter((item) => item.isActive).length + (input.isActive ? 1 : 0) < 1) {
      deny("حداقل یک پیوند فعال در این منو باید بماند.");
    }
    const id = `nav-${crypto.randomUUID()}`;
    await tx.insert(navigationItems).values({
      id,
      menuId: menu.id,
      label,
      href,
      isActive: input.isActive,
      sortOrder: items.length + 1,
    });
    await writeAudit(tx, { actorType: "admin", actorId, action: "content.nav_saved", entityType: "navigation_item", entityId: id });
  });
}

export async function applyNavOrder(db: Database, actorId: string, menuKey: string, ids: string[]): Promise<CmsResult> {
  if (!isMenuKey(menuKey)) return { ok: false, message: "منو شناخته نشد." };
  return transactionResult(db, async (tx, deny) => {
    const [menu] = await tx.select().from(navigationMenus).where(eq(navigationMenus.key, menuKey));
    if (!menu) deny("منو پیدا نشد.");
    await tx.execute(sql`select id from navigation_items where menu_id = ${menu.id} for update`);
    const rows = await tx.select({ id: navigationItems.id }).from(navigationItems).where(eq(navigationItems.menuId, menu.id));
    const order = permutationOrder(rows.map((row) => row.id), ids);
    if (!order) {
      deny(ORDER_GAP);
      return;
    }
    for (let index = 0; index < order.length; index += 1) {
      await tx.update(navigationItems).set({ sortOrder: index + 1 }).where(eq(navigationItems.id, order[index]));
    }
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "content.nav_reordered",
      entityType: "navigation_item",
      entityId: order[0],
      metadata: { menu: menuKey, count: order.length },
    });
  });
}

type ContentEntityType = "page" | "article";

async function appendContentRevision(
  tx: Database,
  actorId: string,
  entityType: ContentEntityType,
  entityId: string,
  snapshot: Record<string, unknown>,
): Promise<void> {
  const [latest] = await tx
    .select({ version: contentRevisions.version })
    .from(contentRevisions)
    .where(and(eq(contentRevisions.entityType, entityType), eq(contentRevisions.entityId, entityId)))
    .orderBy(desc(contentRevisions.version))
    .limit(1);
  await tx.insert(contentRevisions).values({
    id: `rev-${crypto.randomUUID()}`,
    entityType,
    entityId,
    version: (latest?.version ?? 0) + 1,
    snapshot,
    actorId,
  });
}

export async function loadContentHistory(
  db: Database,
  entityType: ContentEntityType,
  entityId: string,
): Promise<Array<{ id: string; version: number; createdAt: string; title: string; status: string }>> {
  const rows = await db
    .select()
    .from(contentRevisions)
    .where(and(eq(contentRevisions.entityType, entityType), eq(contentRevisions.entityId, entityId)))
    .orderBy(desc(contentRevisions.version))
    .limit(30);
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    title: typeof row.snapshot.title === "string" ? row.snapshot.title : "نسخه محتوا",
    status: entityType === "page"
      ? (row.snapshot.isPublished === true ? "published" : "draft")
      : (row.snapshot.status === "published" ? "published" : "draft"),
  }));
}

export async function restoreContentRevision(db: Database, actorId: string, revisionId: string): Promise<CmsResult> {
  return transactionResult(db, async (tx, deny) => {
    const [revision] = await tx.select().from(contentRevisions).where(eq(contentRevisions.id, revisionId));
    if (!revision) deny("نسخه موردنظر پیدا نشد.");
    const snapshot = revision.snapshot;
    const snapshotText = (key: string): string => typeof snapshot[key] === "string" ? snapshot[key] as string : "";
    if (revision.entityType === "page") {
      const [row] = await tx.select().from(sitePages).where(eq(sitePages.id, revision.entityId)).for("update");
      if (!row) deny("صفحه‌ای که این نسخه به آن تعلق دارد پیدا نشد.");
      const title = cleanInline(snapshotText("title"), 2, 120) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const body = cleanBody(snapshotText("body"), 2, 12000) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const seoTitle = cleanInline(snapshotText("seoTitle"), 0, 120) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const seoDescription = cleanInline(snapshotText("seoDescription"), 0, 240) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const isPublished = typeof snapshot.isPublished === "boolean" ? snapshot.isPublished : deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const next = { slug: row.slug, title, body, seoTitle: seoTitle || title, seoDescription, isPublished };
      await tx.update(sitePages).set({ ...next, updatedAt: new Date() }).where(eq(sitePages.id, row.id));
      await appendContentRevision(tx, actorId, "page", row.id, next);
      await writeAudit(tx, { actorType: "admin", actorId, action: "content.page_revision_restored", entityType: "site_page", entityId: row.id, metadata: { revisionId, slug: row.slug } });
      return;
    }
    if (revision.entityType === "article") {
      const [row] = await tx.select().from(articles).where(and(eq(articles.id, revision.entityId), isNull(articles.deletedAt))).for("update");
      if (!row) deny("مقاله‌ای که این نسخه به آن تعلق دارد پیدا نشد.");
      const categoryId = snapshotText("categoryId");
      const [category] = await tx.select({ id: articleCategories.id }).from(articleCategories).where(eq(articleCategories.id, categoryId));
      if (!category) deny("دسته این نسخه دیگر وجود ندارد.");
      const title = cleanInline(snapshotText("title"), 2, 140) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const excerpt = cleanBody(snapshotText("excerpt"), 0, 400) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const content = cleanBody(snapshotText("content"), 0, 20000) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const authorName = cleanInline(snapshotText("authorName"), 2, 80) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const seoTitle = cleanInline(snapshotText("seoTitle"), 0, 120) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const seoDescription = cleanInline(snapshotText("seoDescription"), 0, 240) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const readMinutes = typeof snapshot.readMinutes === "number" && Number.isInteger(snapshot.readMinutes) && snapshot.readMinutes >= 1 && snapshot.readMinutes <= 60
        ? snapshot.readMinutes : deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const status = snapshot.status === "draft" || snapshot.status === "published" ? snapshot.status : deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const slug = parseSlug(snapshotText("slug")) ?? deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      const coverMediaId = typeof snapshot.coverMediaId === "string" ? snapshot.coverMediaId : null;
      const relatedProductIds = Array.isArray(snapshot.relatedProductIds) && snapshot.relatedProductIds.every((id: unknown): id is string => typeof id === "string")
        ? snapshot.relatedProductIds : [];
      if (status === "published" && (excerpt.length < 2 || content.length < 2)) deny("اطلاعات این نسخه معتبر نیست و قابل بازگردانی نیست.");
      await assertCover(tx, coverMediaId, deny);
      const next = {
        categoryId: category.id, slug, title, excerpt, content, authorName, readMinutes,
        coverMediaId, status, seoTitle: seoTitle || title, seoDescription: seoDescription || excerpt,
        publishedAt: status === "published" ? row.publishedAt ?? new Date() : row.publishedAt,
        updatedAt: new Date(),
      };
      await tx.update(articles).set(next).where(eq(articles.id, row.id));
      await replaceRelated(tx, row.id, relatedProductIds, deny);
      await appendContentRevision(tx, actorId, "article", row.id, {
        ...next,
        relatedProductIds: [...new Set(relatedProductIds)],
      });
      await writeAudit(tx, { actorType: "admin", actorId, action: "content.article_revision_restored", entityType: "article", entityId: row.id, metadata: { revisionId, slug } });
      return;
    }
    deny("نوع محتوای این نسخه پشتیبانی نمی‌شود.");
  });
}

export async function applyPagePublication(db: Database, actorId: string, id: string, published: boolean): Promise<CmsResult> {
  return transactionResult(db, async (tx, deny) => {
    const [row] = await tx.select().from(sitePages).where(eq(sitePages.id, id)).for("update");
    if (!row) deny("صفحه پیدا نشد.");
    if (published && (!cleanInline(row.title, 2, 120) || !cleanBody(row.body, 2, 12000))) {
      deny("برای انتشار صفحه، عنوان و متن معتبر لازم است.");
    }
    if (row.isPublished === published) return;
    const snapshot = {
      slug: row.slug,
      title: row.title,
      body: row.body,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      isPublished: published,
    };
    await tx.update(sitePages).set({ isPublished: published, updatedAt: new Date() }).where(eq(sitePages.id, row.id));
    await appendContentRevision(tx, actorId, "page", row.id, snapshot);
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: published ? "content.page_published" : "content.page_unpublished",
      entityType: "site_page",
      entityId: row.id,
      metadata: { slug: row.slug },
    });
  });
}

export async function applyPageUpdate(db: Database, actorId: string, input: PageDraft): Promise<CmsResult> {
  const slug = parseSlug(input.slug);
  const title = cleanInline(input.title, 2, 120);
  const body = cleanBody(input.body, 2, 12000);
  const seoTitle = cleanInline(input.seoTitle, 0, 120);
  const seoDescription = cleanInline(input.seoDescription, 0, 240);
  if (!slug || !title || !body || seoTitle === null || seoDescription === null) return { ok: false, message: "شناسه انگلیسی، عنوان و متن صفحه لازم است." };
  return transactionResult(db, async (tx, deny) => {
    if (!input.id) {
      const id = `page-${crypto.randomUUID()}`;
      const snapshot = { slug, title, body, seoTitle: seoTitle || title, seoDescription, isPublished: input.isPublished };
      await tx.insert(sitePages).values({ id, ...snapshot, updatedAt: new Date() });
      await appendContentRevision(tx, actorId, "page", id, snapshot);
      await writeAudit(tx, { actorType: "admin", actorId, action: "content.page_created", entityType: "site_page", entityId: id, metadata: { slug, published: input.isPublished } });
      return;
    }
    const [row] = await tx.select().from(sitePages).where(eq(sitePages.id, input.id)).for("update");
    if (!row) deny("صفحه پیدا نشد.");
    if (row.slug !== slug) deny("شناسه صفحه‌های موجود با مسیرهای سایت پیوند دارد و قابل تغییر نیست.");
    const snapshot = { slug: row.slug, title, body, seoTitle: seoTitle || title, seoDescription, isPublished: input.isPublished };
    await tx.update(sitePages).set({ title, body, seoTitle: seoTitle || title, seoDescription, isPublished: input.isPublished, updatedAt: new Date() }).where(eq(sitePages.id, row.id));
    await appendContentRevision(tx, actorId, "page", row.id, snapshot);
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "content.page_updated",
      entityType: "site_page",
      entityId: row.id,
      metadata: { slug: row.slug, published: input.isPublished },
    });
  });
}

async function assertCover(tx: Database, coverMediaId: string | null, deny: (message: string) => never): Promise<void> {
  if (!coverMediaId) return;
  const media = await lockLiveMediaAsset(tx, coverMediaId);
  if (!media) deny("جلد انتخاب‌شده در کتابخانه نیست.");
}

async function replaceRelated(tx: Database, articleId: string, productIds: string[], deny: (message: string) => never): Promise<void> {
  const unique = [...new Set(productIds)];
  if (unique.length > 6) deny("حداکثر ۶ محصول مرتبط مجاز است.");
  if (unique.length) {
    const found = await tx.select({ id: products.id }).from(products).where(isNull(products.deletedAt));
    const known = new Set(found.map((row) => row.id));
    if (unique.some((id) => !known.has(id))) deny("یکی از محصولات مرتبط پیدا نشد.");
  }
  await tx.delete(articleProducts).where(eq(articleProducts.articleId, articleId));
  if (unique.length) {
    await tx.insert(articleProducts).values(unique.map((productId) => ({ articleId, productId })));
  }
}

export async function applyArticleSave(db: Database, actorId: string, input: ArticleDraft): Promise<CmsResult> {
  const slug = parseSlug(input.slug);
  const title = cleanInline(input.title, 2, 140);
  const excerpt = cleanBody(input.excerpt, 0, 400);
  const seoTitleInput = cleanInline(input.seoTitle, 0, 120);
  const seoDescriptionInput = cleanInline(input.seoDescription, 0, 240);
  const content = cleanBody(input.content, 0, 20000);
  const authorName = cleanInline(input.authorName, 2, 80);
  if (!slug || !title || !authorName || excerpt === null || seoTitleInput === null || seoDescriptionInput === null || content === null) {
    return { ok: false, message: "نامک، عنوان و نام نویسنده لازم است." };
  }
  const seoTitle = seoTitleInput || title;
  const seoDescription = seoDescriptionInput || excerpt;
  if (!Number.isInteger(input.readMinutes) || input.readMinutes < 1 || input.readMinutes > 60) {
    return { ok: false, message: "زمان مطالعه باید بین ۱ تا ۶۰ دقیقه باشد." };
  }
  if (input.status !== "draft" && input.status !== "published") return { ok: false, message: "وضعیت مقاله معتبر نیست." };
  if (input.status === "published" && (excerpt.length < 2 || content.length < 2)) {
    return { ok: false, message: "مقاله منتشرشده به خلاصه و متن نیاز دارد." };
  }
  return transactionResult(db, async (tx, deny) => {
    const [category] = await tx.select().from(articleCategories).where(eq(articleCategories.id, input.categoryId));
    if (!category) deny("دسته مقاله پیدا نشد.");
    await assertCover(tx, input.coverMediaId, deny);
    if (!input.id) {
      const id = `art-${crypto.randomUUID()}`;
      await tx.insert(articles).values({
        id,
        categoryId: category.id,
        slug,
        title,
        excerpt,
        content,
        authorName,
        readMinutes: input.readMinutes,
        coverMediaId: input.coverMediaId,
        status: input.status,
        seoTitle,
        seoDescription,
        publishedAt: input.status === "published" ? new Date() : null,
      });
      await replaceRelated(tx, id, input.relatedProductIds, deny);
      await appendContentRevision(tx, actorId, "article", id, {
        categoryId: category.id, slug, title, excerpt, content, authorName, readMinutes: input.readMinutes,
        coverMediaId: input.coverMediaId, status: input.status, seoTitle, seoDescription,
        publishedAt: input.status === "published" ? new Date().toISOString() : null,
        relatedProductIds: [...new Set(input.relatedProductIds)],
      });
      await writeAudit(tx, {
        actorType: "admin",
        actorId,
        action: "content.article_saved",
        entityType: "article",
        entityId: id,
        metadata: { slug, status: input.status },
      });
      return;
    }
    const [row] = await tx.select().from(articles).where(and(eq(articles.id, input.id), isNull(articles.deletedAt))).for("update");
    if (!row) deny("مقاله پیدا نشد.");
    await tx
      .update(articles)
      .set({
        categoryId: category.id,
        slug,
        title,
        excerpt,
        content,
        authorName,
        readMinutes: input.readMinutes,
        coverMediaId: input.coverMediaId,
        status: input.status,
        seoTitle,
        seoDescription,
        publishedAt: input.status === "published" ? row.publishedAt ?? new Date() : row.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, row.id));
    await replaceRelated(tx, row.id, input.relatedProductIds, deny);
    await appendContentRevision(tx, actorId, "article", row.id, {
      categoryId: category.id, slug, title, excerpt, content, authorName, readMinutes: input.readMinutes,
      coverMediaId: input.coverMediaId, status: input.status, seoTitle, seoDescription,
      publishedAt: input.status === "published" ? (row.publishedAt ?? new Date()).toISOString() : row.publishedAt?.toISOString() ?? null,
      relatedProductIds: [...new Set(input.relatedProductIds)],
    });
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "content.article_saved",
      entityType: "article",
      entityId: row.id,
      metadata: { slug, status: input.status },
    });
  });
}

export async function applyArticlePublication(db: Database, actorId: string, id: string, published: boolean): Promise<CmsResult> {
  return transactionResult(db, async (tx, deny) => {
    const [row] = await tx.select().from(articles)
      .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
      .for("update");
    if (!row) deny("مقاله پیدا نشد.");
    if (published && (cleanBody(row.excerpt, 2, 400) === null || cleanBody(row.content, 2, 20000) === null)) {
      deny("برای انتشار مقاله، خلاصه و متن معتبر لازم است.");
    }
    if (row.status === (published ? "published" : "draft")) return;
    const relatedRows = await tx.select({ productId: articleProducts.productId })
      .from(articleProducts).where(eq(articleProducts.articleId, row.id));
    const publishedAt = published ? row.publishedAt ?? new Date() : row.publishedAt;
    await tx.update(articles).set({
      status: published ? "published" : "draft",
      publishedAt,
      updatedAt: new Date(),
    }).where(eq(articles.id, row.id));
    await appendContentRevision(tx, actorId, "article", row.id, {
      categoryId: row.categoryId,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      content: row.content,
      authorName: row.authorName,
      readMinutes: row.readMinutes,
      coverMediaId: row.coverMediaId,
      status: published ? "published" : "draft",
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      publishedAt: publishedAt?.toISOString() ?? null,
      relatedProductIds: relatedRows.map((item) => item.productId),
    });
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: published ? "content.article_published" : "content.article_unpublished",
      entityType: "article",
      entityId: row.id,
      metadata: { slug: row.slug },
    });
  });
}

export async function applyArticleRetire(db: Database, actorId: string, id: string): Promise<CmsResult> {
  return transactionResult(db, async (tx, deny) => {
    const [row] = await tx.select().from(articles).where(and(eq(articles.id, id), isNull(articles.deletedAt))).for("update");
    if (!row) deny("مقاله پیدا نشد.");
    await tx.update(articles).set({ status: "draft", deletedAt: new Date(), updatedAt: new Date() }).where(eq(articles.id, row.id));
    await writeAudit(tx, { actorType: "admin", actorId, action: "content.article_retired", entityType: "article", entityId: row.id });
  });
}

export async function registerExternalMedia(db: Database, actorId: string, input: { url: string; alt: string }): Promise<CmsResult> {
  const url = parseExternalMediaUrl(input.url);
  const mime = url ? imageMimeFromUrl(url) : null;
  const alt = cleanInline(input.alt, 2, 120);
  if (!url || !mime || !alt) return { ok: false, message: "فقط نشانی https یک تصویر، به همراه متن جایگزین، پذیرفته می‌شود." };
  return transactionResult(db, async (tx, deny) => {
    const [existing] = await tx
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.publicUrl, url), isNull(mediaAssets.deletedAt)))
      .limit(1);
    if (existing) deny("این نشانی قبلاً ثبت شده است.");
    const id = `med-${crypto.randomUUID()}`;
    await tx.insert(mediaAssets).values({
      id,
      folder: "external",
      filename: filenameFromUrl(url),
      mimeType: mime,
      byteSize: 0,
      alt,
      storageKey: `external:${createHash("sha256").update(url).digest("hex")}`,
      publicUrl: url,
    });
    await writeAudit(tx, { actorType: "admin", actorId, action: "content.media_registered", entityType: "media_asset", entityId: id });
  });
}

export async function retireMedia(db: Database, actorId: string, id: string): Promise<CmsResult> {
  let removeName: string | null = null;
  let removeStorageKey: string | null = null;
  const result = await transactionResult(db, async (tx, deny) => {
    const row = await lockLiveMediaAsset(tx, id);
    if (!row) deny("رسانه پیدا نشد.");
    if (isOfficialBrandAsset(row.publicUrl)) deny("فایل رسمی برند حذف نمی‌شود.");
    if (await mediaInUse(tx, row.id)) deny("این رسانه هنوز به بنر، مقاله یا تصویر محصول وصل است.");
    await tx.update(mediaAssets).set({ deletedAt: new Date() }).where(eq(mediaAssets.id, row.id));
    await writeAudit(tx, { actorType: "admin", actorId, action: "content.media_retired", entityType: "media_asset", entityId: row.id });
    removeName = objectNameForStorageKey(row.storageKey);
    removeStorageKey = row.storageKey;
  });
  if (!result.ok) return result;
  const storage = openStorage();
  // Only delete through the adapter that owns this exact provider-qualified key.
  if (removeName && storage?.storageKey(removeName) === removeStorageKey) {
    await removeFileOrRecord(db, id, removeName, storage);
  } else if (removeName) {
    await removeFileOrRecord(db, id, removeName, null);
  }
  // Earlier failed file cleanups are retried here (each re-verifies under the asset lock); never blocks the result.
  await retryPendingMediaCleanup(db, storage).catch(() => undefined);
  return result;
}

export { isSectionType };
