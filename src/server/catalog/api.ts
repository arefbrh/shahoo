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

function parseAdminInput<T>(schema: z.ZodType<T>, input: unknown, labels: Record<string, string>): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = labels[String(issue?.path[0] ?? "")] ?? "اطلاعات فرم";
  const guidance = issue?.code === "too_small"
    ? "این فیلد اجباری است یا کوتاه‌تر از حد مجاز وارد شده است."
    : issue?.code === "too_big"
      ? "طول مقدار واردشده بیش از حد مجاز است."
      : "مقدار واردشده معتبر نیست؛ قالب آن را بررسی کنید.";
  throw new Error(`${field}: ${guidance}`);
}

async function runCatalogMutation(operation: () => Promise<CatalogResult>): Promise<CatalogResult> {
  try {
    return await operation();
  } catch (error) {
    const reference = crypto.randomUUID().slice(0, 8);
    console.error(`[admin.catalog:${reference}] mutation failed`, error);
    return { ok: false, message: `ذخیره انجام نشد؛ خطای فنی ثبت شد. کد پیگیری: ${reference}` };
  }
}

export const saveCategoryFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseAdminInput(categorySchema, input, {
    name: "نام دسته", shortName: "نام کوتاه", slug: "شناسه انگلیسی",
    sortOrder: "ترتیب نمایش", iconType: "نشان دسته",
  }))
  .handler(async ({ data }): Promise<CatalogResult> => runCatalogMutation(() => saveCategory(data)));

export const saveProductFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => parseAdminInput(productSchema, input, {
    categoryId: "دسته محصول", name: "نام محصول", slug: "شناسه انگلیسی",
    sku: "کد محصول", variants: "بسته‌ها", imageUrl: "نشانی تصویر",
  }))
  .handler(async ({ data }): Promise<CatalogResult> => runCatalogMutation(() => saveProduct(data)));

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
