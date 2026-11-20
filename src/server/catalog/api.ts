import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AdminCatalog, CatalogResult } from "@/lib/catalog-types";
import { adjustInventory, loadAdminCatalog, saveCategory, saveProduct } from "./admin";
import { attachForAdmin, detachForAdmin, reorderForAdmin } from "../media/storage";

const variantSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  sku: z.string().min(2).max(40),
  label: z.string().min(1).max(40),
  unitKind: z.enum(["volume", "weight", "custom"]),
  amount: z.number().int().nullable(),
  priceToman: z.number().int(),
  compareAtToman: z.number().int().nullable(),
  isDefault: z.boolean(),
  status: z.enum(["active", "inactive"]),
  openingOnHand: z.number().int().min(0).max(100_000).optional(),
});

const productSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  categoryId: z.string().min(2).max(80),
  name: z.string().min(2).max(80),
  englishName: z.string().max(80).default(""),
  subtitle: z.string().max(80).default(""),
  homepageTitle: z.string().max(120).default(""),
  homepageSubtitle: z.string().max(200).default(""),
  slug: z.string().min(2).max(80),
  sku: z.string().min(2).max(40),
  status: z.enum(["draft", "published"]),
  shortDescription: z.string().max(400).default(""),
  fullDescription: z.string().max(4000).default(""),
  origin: z.string().max(200).default(""),
  ingredients: z.string().max(500).default(""),
  usageInstructions: z.string().max(1200).default(""),
  storageInstructions: z.string().max(800).default(""),
  seoTitle: z.string().max(120).default(""),
  seoDescription: z.string().max(240).default(""),
  oilFinder: z.object({
    intendedUse: z.array(z.enum(["skin", "hair", "cooking", "general"])).max(4),
    texture: z.enum(["", "light", "rich"]),
    scent: z.enum(["", "mild", "herbal"]),
  }).nullable().default(null),
  specs: z.array(z.object({ label: z.string().max(40), value: z.string().max(160) })).max(12).default([]),
  isOrganic: z.boolean(),
  isBestSeller: z.boolean(),
  isFeatured: z.boolean(),
  imageUrl: z.string().max(500).default(""),
  variants: z.array(variantSchema).min(1).max(8),
});

const categorySchema = z.object({
  id: z.string().min(2).max(80).optional(),
  name: z.string().min(2).max(60),
  englishName: z.string().max(80).default(""),
  shortName: z.string().min(2).max(40),
  slug: z.string().min(2).max(80),
  description: z.string().max(400).default(""),
  iconType: z.string().min(2).max(20),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

export const getAdminCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<AdminCatalog> => loadAdminCatalog());

export const saveCategoryFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => categorySchema.parse(input))
  .handler(async ({ data }): Promise<CatalogResult> => saveCategory(data));

export const saveProductFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => productSchema.parse(input))
  .handler(async ({ data }): Promise<CatalogResult> => saveProduct(data));

export const adjustInventoryFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ variantId: z.string().min(2).max(80), delta: z.number().int(), note: z.string().min(2).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<CatalogResult> => adjustInventory(data.variantId, data.delta, data.note));

export const attachProductMediaFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ productId: z.string().min(2).max(80), mediaId: z.string().min(2).max(80), primary: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => attachForAdmin(data.productId, data.mediaId, data.primary));

export const detachProductImageFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ imageId: z.string().min(2).max(80) }).parse(input))
  .handler(async ({ data }) => detachForAdmin(data.imageId));

export const reorderProductImagesFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ productId: z.string().min(2).max(80), ids: z.array(z.string().min(2).max(80)).max(20) }).parse(input))
  .handler(async ({ data }) => reorderForAdmin(data.productId, data.ids));
