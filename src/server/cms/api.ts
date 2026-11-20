import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CmsDesk, CmsResult } from "@/lib/cms-types";
import { requireAdmin } from "../auth/guard";
import {
  applyArticleRetire,
  applyArticleSave,
  applyBrandSettings,
  applyCarouselSettings,
  applyStoreLayout,
  applyBannerOrder,
  applyBannerSave,
  applyNavOrder,
  applyNavSave,
  applyPageUpdate,
  applySectionOrder,
  applySectionUpdate,
  applySiteCopy,
  applyStoreProfile,
  loadCmsDesk,
  loadContentHistory,
  restoreContentRevision,
  registerExternalMedia,
  retireMedia,
} from "./content";

const flags = z.enum(["featured", "best", "offer", "newest"]);

const sectionSchema = z.object({
  id: z.string().min(2).max(80),
  title: z.string().max(200),
  subtitle: z.string().max(300),
  body: z.string().max(4000),
  isActive: z.boolean(),
  config: z.object({
    limit: z.number().int().optional(),
    flags: z.array(flags).max(4).optional(),
    items: z.array(z.object({ title: z.string().max(80), text: z.string().max(300) })).max(6).optional(),
  }),
});

const bannerSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  title: z.string().max(200),
  subtitle: z.string().max(300),
  body: z.string().max(800),
  ctaLabel: z.string().max(80),
  ctaHref: z.string().max(300),
  isActive: z.boolean(),
  startsOn: z.string().max(10),
  endsOn: z.string().max(10),
  desktopMediaId: z.string().max(80).nullable().optional(),
  mobileMediaId: z.string().max(80).nullable().optional(),
});

const navSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  menuKey: z.string().min(2).max(40),
  label: z.string().max(80),
  href: z.string().max(300),
  isActive: z.boolean(),
});

const pageSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  slug: z.string().min(2).max(80),
  title: z.string().max(200),
  body: z.string().max(12000),
  seoTitle: z.string().max(200),
  seoDescription: z.string().max(300),
  isPublished: z.boolean(),
});

const articleSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  slug: z.string().max(80),
  title: z.string().max(200),
  excerpt: z.string().max(500),
  seoTitle: z.string().max(120).default(""),
  seoDescription: z.string().max(240).default(""),
  content: z.string().max(20000),
  authorName: z.string().max(80),
  readMinutes: z.number().int(),
  status: z.enum(["draft", "published"]),
  categoryId: z.string().max(80),
  coverMediaId: z.string().min(2).max(80).nullable(),
  relatedProductIds: z.array(z.string().min(2).max(80)).max(6),
});

async function withContentWrite<T>(run: (db: Awaited<ReturnType<typeof requireAdmin>>["db"], actorId: string) => Promise<T>): Promise<T> {
  const { db, admin } = await requireAdmin("content.write");
  return run(db, admin.id);
}

export const getCmsDesk = createServerFn({ method: "GET" }).handler(async (): Promise<CmsDesk> => withContentWrite((db) => loadCmsDesk(db)));

export const saveSiteCopyFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ storyTitle: z.string().max(120), storyAbout: z.string().max(2000), storyPhilosophy: z.string().max(2000), promo: z.string().max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applySiteCopy(db, actorId, data)));

export const saveCarouselSettingsFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ autoPlay: z.boolean(), intervalMs: z.number().int().min(3000).max(15000) }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyCarouselSettings(db, actorId, data)));

export const saveStoreLayoutFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    stickyHeader: z.boolean(),
    headerLogoHeight: z.number().int().min(40).max(80),
    footerLogoHeight: z.number().int().min(64).max(144),
    footerAlignment: z.enum(["start", "center"]),
  }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyStoreLayout(db, actorId, data)));

export const saveBrandSettingsFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      brandName: z.string().max(80),
      tagline: z.string().max(180),
      copyright: z.string().max(180),
      headerLogo: z.string().max(500),
      footerLogo: z.string().max(500),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyBrandSettings(db, actorId, data)));

export const saveStoreProfileFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        phone: z.string().max(40),
        whatsapp: z.string().max(40),
        email: z.string().max(120),
        address: z.string().max(300),
        instagram: z.string().max(40),
        telegram: z.string().max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyStoreProfile(db, actorId, data)));

export const saveSectionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => sectionSchema.parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applySectionUpdate(db, actorId, data)));

export const saveSectionOrderFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ ids: z.array(z.string().min(2).max(80)).min(1).max(30) }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applySectionOrder(db, actorId, data.ids)));

export const saveBannerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => bannerSchema.parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyBannerSave(db, actorId, data)));

export const saveBannerOrderFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ ids: z.array(z.string().min(2).max(80)).min(1).max(8) }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyBannerOrder(db, actorId, data.ids)));

export const saveNavFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => navSchema.parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyNavSave(db, actorId, data)));

export const saveNavOrderFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ menuKey: z.string().min(2).max(40), ids: z.array(z.string().min(2).max(80)).min(1).max(12) }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyNavOrder(db, actorId, data.menuKey, data.ids)));

export const getContentHistoryFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({
    entityType: z.enum(["page", "article"]),
    entityId: z.string().min(2).max(100),
  }).parse(input))
  .handler(async ({ data }) => withContentWrite((db) => loadContentHistory(db, data.entityType, data.entityId)));

export const restoreContentRevisionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ revisionId: z.string().min(2).max(100) }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => restoreContentRevision(db, actorId, data.revisionId)));

export const savePageFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => pageSchema.parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyPageUpdate(db, actorId, data)));

export const saveArticleFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => articleSchema.parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyArticleSave(db, actorId, data)));

export const retireArticleFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(2).max(80) }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => applyArticleRetire(db, actorId, data.id)));

export const registerMediaFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ url: z.string().max(500), alt: z.string().max(160) }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => registerExternalMedia(db, actorId, data)));

export const retireMediaFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(2).max(80) }).parse(input))
  .handler(async ({ data }): Promise<CmsResult> => withContentWrite((db, actorId) => retireMedia(db, actorId, data.id)));
