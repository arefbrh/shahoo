import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { irrToToman } from "@/lib/money";
import type { AdminCatalog, AdminProduct, CatalogResult } from "@/lib/catalog-types";
import { writeAudit } from "../auth/audit";
import { lockLiveMediaAsset } from "../media/lock.ts";
import { SessionError, requireAdmin } from "../auth/guard";
import type { AppDatabase } from "../db/client";
import type { AdminPrincipal } from "../auth/sessions";
import {
  inventory,
  inventoryLogs,
  mediaAssets,
  productCategories,
  productImages,
  productSpecs,
  productVariants,
  products,
} from "../db/schema";
import {
  applyStockDelta,
  canPublish,
  chooseSellableDefault,
  cleanCatalogText,
  normalizeSku,
  normalizeSlug,
  parseIconType,
  parseImageUrl,
  parseToman,
} from "./rules";

type VariantInput = {
  id?: string;
  sku: string;
  label: string;
  unitKind: "volume" | "weight" | "custom";
  amount: number | null;
  priceToman: number;
  compareAtToman: number | null;
  isDefault: boolean;
  status: "active" | "inactive";
  openingOnHand?: number;
};

type ProductInput = {
  id?: string;
  categoryId: string;
  name: string;
  englishName: string;
  subtitle: string;
  homepageTitle: string;
  homepageSubtitle: string;
  slug: string;
  sku: string;
  status: "draft" | "published";
  shortDescription: string;
  fullDescription: string;
  origin: string;
  ingredients: string;
  usageInstructions: string;
  storageInstructions: string;
  seoTitle: string;
  seoDescription: string;
  oilFinder: { intendedUse: string[]; texture: string; scent: string } | null;
  specs: Array<{ label: string; value: string }>;
  isOrganic: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  imageUrl: string;
  variants: VariantInput[];
};

type CategoryInput = {
  id?: string;
  name: string;
  englishName: string;
  shortName: string;
  slug: string;
  description: string;
  iconType: string;
  isActive: boolean;
  sortOrder: number;
};

export async function loadAdminCatalog(): Promise<AdminCatalog> {
  const { db } = await requireAdmin("catalog.read");
  const categories = await db
    .select()
    .from(productCategories)
    .where(isNull(productCategories.deletedAt))
    .orderBy(asc(productCategories.sortOrder));
  const rows = await db
    .select()
    .from(products)
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.catalogOrder));
  const variantRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      label: productVariants.label,
      unitKind: productVariants.unitKind,
      amount: productVariants.amount,
      priceIrr: productVariants.priceIrr,
      compareAtPriceIrr: productVariants.compareAtPriceIrr,
      isDefault: productVariants.isDefault,
      status: productVariants.status,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      sortOrder: productVariants.sortOrder,
    })
    .from(productVariants)
    .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(isNull(productVariants.deletedAt))
    .orderBy(asc(productVariants.sortOrder));
  const images = await db.select().from(productImages).orderBy(asc(productImages.sortOrder), asc(productImages.createdAt));
  const specRows = await db.select().from(productSpecs).orderBy(asc(productSpecs.sortOrder));
  const mediaRows = await db
    .select({
      id: mediaAssets.id,
      alt: mediaAssets.alt,
      publicUrl: mediaAssets.publicUrl,
      mimeType: mediaAssets.mimeType,
    })
    .from(mediaAssets)
    .where(isNull(mediaAssets.deletedAt))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(100);
  const galleryByProduct = new Map<string, AdminProduct["gallery"]>();
  const imageByProduct = new Map<string, string>();
  for (const image of images) {
    const list = galleryByProduct.get(image.productId) ?? [];
    list.push({ id: image.id, mediaId: image.mediaId, url: image.url, alt: image.alt, isPrimary: image.isPrimary });
    galleryByProduct.set(image.productId, list);
    if (image.isPrimary && !imageByProduct.has(image.productId)) imageByProduct.set(image.productId, image.url);
  }
  const byProduct = new Map<string, AdminProduct["variants"]>();
  const specsByProduct = new Map<string, AdminProduct["specs"]>();
  for (const row of specRows) {
    const list = specsByProduct.get(row.productId) ?? [];
    list.push({ label: row.label, value: row.value });
    specsByProduct.set(row.productId, list);
  }
  for (const row of variantRows) {
    const list = byProduct.get(row.productId) ?? [];
    list.push({
      id: row.id,
      sku: row.sku,
      label: row.label,
      unitKind: row.unitKind,
      amount: row.amount,
      priceToman: irrToToman(row.priceIrr),
      compareAtToman: row.compareAtPriceIrr === null ? null : irrToToman(row.compareAtPriceIrr),
      isDefault: row.isDefault,
      status: row.status,
      onHand: row.onHand,
      reserved: row.reserved,
      sellable: Math.max(0, row.onHand - row.reserved),
    });
    byProduct.set(row.productId, list);
  }
  return {
    categories: categories.map((row) => ({
      id: row.id,
      name: row.name,
      englishName: row.englishName,
      shortName: row.shortName,
      slug: row.slug,
      description: row.description,
      iconType: row.iconType,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    })),
    products: rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      englishName: row.englishName,
      subtitle: row.subtitle,
      homepageTitle: row.homepageTitle,
      homepageSubtitle: row.homepageSubtitle,
      slug: row.slug,
      sku: row.sku,
      status: row.status,
      shortDescription: row.shortDescription,
      fullDescription: row.fullDescription,
      origin: row.origin,
      ingredients: row.ingredients,
      usageInstructions: row.usageInstructions,
      storageInstructions: row.storageInstructions,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      oilFinder: row.oilFinder,
      specs: specsByProduct.get(row.id) ?? [],
      isOrganic: row.isOrganic,
      isBestSeller: row.isBestSeller,
      isFeatured: row.isFeatured,
      imageUrl: imageByProduct.get(row.id) ?? "",
      gallery: galleryByProduct.get(row.id) ?? [],
      variants: byProduct.get(row.id) ?? [],
    })),
    media: mediaRows,
  };
}

export async function saveCategory(input: CategoryInput): Promise<CatalogResult> {
  try {
    const { db, admin } = await requireAdmin("catalog.write");
    const name = cleanCatalogText(input.name, 2, 60);
    const englishName = input.englishName.trim() ? cleanCatalogText(input.englishName, 2, 80) : "";
    const shortName = cleanCatalogText(input.shortName, 2, 40);
    const slug = normalizeSlug(input.slug);
    const description = input.description.trim() ? cleanCatalogText(input.description, 2, 400) : "";
    const iconType = parseIconType(input.iconType);
    if (!name || englishName === null || !shortName || !slug || description === null || !iconType) {
      return { ok: false, message: "نام، نام کوتاه، شناسه انگلیسی و نوع دسته را درست وارد کنید." };
    }
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 999) {
      return { ok: false, message: "ترتیب دسته باید بین ۰ و ۹۹۹ باشد." };
    }
    const [slugOwner] = await db.select({ id: productCategories.id }).from(productCategories).where(eq(productCategories.slug, slug)).limit(1);
    if (slugOwner && slugOwner.id !== input.id) return { ok: false, message: "این شناسه دسته قبلاً استفاده شده است." };

    const id = input.id || `cat-${crypto.randomUUID()}`;
    await db.transaction(async (tx) => {
      if (input.id) {
        const [existing] = await tx.select({ id: productCategories.id }).from(productCategories).where(eq(productCategories.id, input.id)).limit(1);
        if (!existing) throw new CatalogError("دسته پیدا نشد.");
        await tx
          .update(productCategories)
          .set({
            name,
            englishName,
            shortName,
            slug,
            description: description ?? "",
            iconType,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(productCategories.id, input.id));
      } else {
        await tx.insert(productCategories).values({
          id,
          name,
          englishName,
          shortName,
          slug,
          description: description ?? "",
          iconType,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        });
      }
      await writeAudit(tx, {
        actorType: "admin",
        actorId: admin.id,
        action: "catalog.category_saved",
        entityType: "product_category",
        entityId: id,
        metadata: { label: name, slug },
      });
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveProduct(input: ProductInput): Promise<CatalogResult> {
  try {
    const { db, admin } = await requireAdmin("catalog.write");
    return await saveProductWithAdmin(db, admin, input);
  } catch (error) {
    return fail(error);
  }
}

export async function saveProductWithAdmin(db: AppDatabase, admin: AdminPrincipal, input: ProductInput): Promise<CatalogResult> {
  if (!admin.permissions.includes("catalog.write")) return { ok: false, message: "این دسترسی برای نقش شما فعال نیست." };
  try {
    const parsed = parseProduct(input);
    if (!parsed.ok) return parsed;
    const data = parsed.value;
    const opensStock = data.variants.some((variant) => !variant.id && variant.openingOnHand > 0);
    if (opensStock && !admin.permissions.includes("inventory.write")) {
      return { ok: false, message: "موجودی اولیه فقط با دسترسی موجودی ثبت می‌شود. مقدار را صفر بگذارید." };
    }
    const [category] = await db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(eq(productCategories.id, data.categoryId))
      .limit(1);
    if (!category) return { ok: false, message: "دسته انتخاب‌شده وجود ندارد." };

    await db.transaction(async (tx) => {
      const id = data.id ?? `prod-${crypto.randomUUID()}`;
      if (data.id) {
        const [current] = await tx.select().from(products).where(eq(products.id, data.id)).limit(1);
        if (!current || current.deletedAt) throw new CatalogError("محصول پیدا نشد.");
        const existingVariants = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(and(eq(productVariants.productId, data.id), isNull(productVariants.deletedAt)));
        const sent = new Set(data.variants.flatMap((variant) => (variant.id ? [variant.id] : [])));
        if (existingVariants.some((variant) => !sent.has(variant.id))) {
          throw new CatalogError("بسته‌های قبلی را حذف نکنید. می‌توانید آن‌ها را غیرفعال کنید.");
        }
        await tx
          .update(products)
          .set({
            categoryId: data.categoryId,
            slug: data.slug,
            sku: data.sku,
            name: data.name,
            englishName: data.englishName,
            subtitle: data.subtitle,
            homepageTitle: data.homepageTitle,
            homepageSubtitle: data.homepageSubtitle,
            shortDescription: data.shortDescription,
            fullDescription: data.fullDescription,
            origin: data.origin,
            ingredients: data.ingredients,
            usageInstructions: data.usageInstructions,
            storageInstructions: data.storageInstructions,
            seoTitle: data.seoTitle || data.name,
            seoDescription: data.seoDescription || data.shortDescription,
            oilFinder: data.oilFinder,
            isOrganic: data.isOrganic,
            isBestSeller: data.isBestSeller,
            isFeatured: data.isFeatured,
            status: data.status,
            updatedAt: new Date(),
          })
          .where(eq(products.id, data.id));
      } else {
        const [last] = await tx
          .select({ catalogOrder: products.catalogOrder })
          .from(products)
          .orderBy(sql`${products.catalogOrder} desc`)
          .limit(1);
        await tx.insert(products).values({
          id,
          categoryId: data.categoryId,
          slug: data.slug,
          sku: data.sku,
          name: data.name,
          englishName: data.englishName,
          subtitle: data.subtitle,
          homepageTitle: data.homepageTitle,
          homepageSubtitle: data.homepageSubtitle,
          shortDescription: data.shortDescription,
          fullDescription: data.fullDescription,
          origin: data.origin,
          ingredients: data.ingredients,
          usageInstructions: data.usageInstructions,
          storageInstructions: data.storageInstructions,
          seoTitle: data.seoTitle || data.name,
          seoDescription: data.seoDescription || data.shortDescription,
          oilFinder: data.oilFinder,
          isOrganic: data.isOrganic,
          isBestSeller: data.isBestSeller,
          isFeatured: data.isFeatured,
          status: data.status,
          catalogOrder: (last?.catalogOrder ?? 0) + 1,
        });
      }
      await tx.delete(productSpecs).where(eq(productSpecs.productId, id));
      if (data.specs.length) {
        await tx.insert(productSpecs).values(
          data.specs.map((spec, index) => ({
            id: `spec-${crypto.randomUUID()}`,
            productId: id,
            label: spec.label,
            value: spec.value,
            sortOrder: index + 1,
          })),
        );
      }

      const defaultIndex = chooseSellableDefault(
        data.variants.map((variant) => ({ isDefault: variant.isDefault, active: variant.status === "active" })),
      );
      for (const [index, variant] of data.variants.entries()) {
        const isDefault = index === defaultIndex;
        if (variant.id) {
          const [owned] = await tx
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(and(eq(productVariants.id, variant.id), eq(productVariants.productId, id)))
            .limit(1);
          if (!owned) throw new CatalogError("یکی از بسته‌ها متعلق به این محصول نیست.");
          await tx
            .update(productVariants)
            .set({
              sku: variant.sku,
              label: variant.label,
              unitKind: variant.unitKind,
              amount: variant.amount,
              priceIrr: variant.priceIrr,
              compareAtPriceIrr: variant.compareAtIrr,
              isDefault,
              status: variant.status,
              sortOrder: index + 1,
              updatedAt: new Date(),
            })
            .where(eq(productVariants.id, variant.id));
        } else {
          const variantId = `var-${crypto.randomUUID()}`;
          await tx.insert(productVariants).values({
            id: variantId,
            productId: id,
            sku: variant.sku,
            label: variant.label,
            unitKind: variant.unitKind,
            amount: variant.amount,
            priceIrr: variant.priceIrr,
            compareAtPriceIrr: variant.compareAtIrr,
            isDefault,
            status: variant.status,
            sortOrder: index + 1,
          });
          await tx.insert(inventory).values({
            variantId,
            onHand: variant.openingOnHand,
            reserved: 0,
            lowStockThreshold: 5,
          });
          if (variant.openingOnHand > 0) {
            await tx.insert(inventoryLogs).values({
              id: `ilog-${crypto.randomUUID()}`,
              variantId,
              delta: variant.openingOnHand,
              reason: "opening_balance",
              note: "موجودی اولیه از پنل مدیر",
              actorAdminId: admin.id,
              onHandBefore: 0,
              onHandAfter: variant.openingOnHand,
              reservedBefore: 0,
              reservedAfter: 0,
            });
          }
        }
      }
      await writePrimaryImage(tx, id, data.imageUrl);
      await writeAudit(tx, {
        actorType: "admin",
        actorId: admin.id,
        action: "catalog.product_saved",
        entityType: "product",
        entityId: id,
        metadata: { label: data.name, slug: data.slug, status: data.status },
      });
      return id;
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function adjustInventory(variantId: string, delta: number, note: string): Promise<CatalogResult> {
  try {
    const { db, admin } = await requireAdmin("inventory.write");
    const cleanNote = cleanCatalogText(note, 2, 200);
    if (!cleanNote) return { ok: false, message: "دلیل اصلاح موجودی را بین ۲ تا ۲۰۰ حرف بنویسید." };
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ variantId: inventory.variantId, onHand: inventory.onHand, reserved: inventory.reserved, sku: productVariants.sku })
        .from(inventory)
        .innerJoin(productVariants, eq(productVariants.id, inventory.variantId))
        .where(eq(inventory.variantId, variantId))
        .for("update")
        .limit(1);
      if (!row) return { ok: false as const, message: "بسته پیدا نشد." };
      const decision = applyStockDelta(row.onHand, row.reserved, delta);
      if (!decision.ok) return decision;
      const rows = await tx
        .update(inventory)
        .set({ onHand: sql`${inventory.onHand} + ${delta}`, updatedAt: new Date() })
        .where(
          and(
            eq(inventory.variantId, variantId),
            eq(inventory.onHand, row.onHand),
            eq(inventory.reserved, row.reserved),
            sql`${inventory.onHand} + ${delta} >= ${inventory.reserved}`,
            sql`${inventory.onHand} + ${delta} >= 0`,
          ),
        )
        .returning({ onHand: inventory.onHand, reserved: inventory.reserved });
      if (rows.length === 0) return { ok: false as const, message: "موجودی هم‌زمان تغییر کرد. دوباره تلاش کنید." };
      const after = rows[0]!;
      await tx.insert(inventoryLogs).values({
        id: `ilog-${crypto.randomUUID()}`,
        variantId,
        delta,
        reason: "adjustment",
        note: cleanNote,
        actorAdminId: admin.id,
        onHandBefore: row.onHand,
        onHandAfter: after.onHand,
        reservedBefore: row.reserved,
        reservedAfter: after.reserved,
      });
      await writeAudit(tx, {
        actorType: "admin",
        actorId: admin.id,
        action: "inventory.adjusted",
        entityType: "product_variant",
        entityId: variantId,
        metadata: { label: row.sku, delta },
      });
      return { ok: true as const };
    });
    return result;
  } catch (error) {
    return fail(error);
  }
}

type ParsedVariant = {
  id?: string;
  sku: string;
  label: string;
  unitKind: "volume" | "weight" | "custom";
  amount: number | null;
  priceIrr: number;
  compareAtIrr: number | null;
  isDefault: boolean;
  status: "active" | "inactive";
  openingOnHand: number;
};

export function parseProduct(input: ProductInput): { ok: true; value: Omit<ProductInput, "variants" | "imageUrl"> & { imageUrl: string; variants: ParsedVariant[] } } | { ok: false; message: string } {
  const name = cleanCatalogText(input.name, 2, 80);
  const slug = normalizeSlug(input.slug);
  const sku = normalizeSku(input.sku);
  const englishName = input.englishName.trim() ? cleanCatalogText(input.englishName, 2, 80) : "";
  const subtitle = input.subtitle.trim() ? cleanCatalogText(input.subtitle, 2, 80) : "";
  const homepageTitle = input.homepageTitle.trim() ? cleanCatalogText(input.homepageTitle, 2, 120) : name;
  const homepageSubtitle = input.homepageSubtitle.trim() ? cleanCatalogText(input.homepageSubtitle, 2, 200) : "";
  const shortDescription = input.shortDescription.trim() ? cleanCatalogText(input.shortDescription, 2, 400) : "";
  const fullDescription = input.fullDescription.trim() ? cleanCatalogText(input.fullDescription, 2, 4000) : "";
  const origin = input.origin.trim() ? cleanCatalogText(input.origin, 2, 200) : "";
  const ingredients = input.ingredients.trim() ? cleanCatalogText(input.ingredients, 2, 500) : "";
  const usageInstructions = input.usageInstructions.trim() ? cleanCatalogText(input.usageInstructions, 2, 1200) : "";
  const storageInstructions = input.storageInstructions.trim() ? cleanCatalogText(input.storageInstructions, 2, 800) : "";
  const seoTitle = input.seoTitle.trim() ? cleanCatalogText(input.seoTitle, 2, 120) : "";
  const seoDescription = input.seoDescription.trim() ? cleanCatalogText(input.seoDescription, 2, 240) : "";
  const imageUrl = parseImageUrl(input.imageUrl);
  if (!name || !slug || !sku || englishName === null || subtitle === null || homepageTitle === null || homepageSubtitle === null || shortDescription === null || fullDescription === null || origin === null || ingredients === null || usageInstructions === null || storageInstructions === null || seoTitle === null || seoDescription === null || imageUrl === null) {
    return { ok: false, message: "نام، شناسه انگلیسی، کد کالا یا تصویر را درست وارد کنید. تصویر فقط نشانی https است." };
  }
  const specs: Array<{ label: string; value: string }> = [];
  for (const spec of input.specs) {
    if (!spec.label.trim() && !spec.value.trim()) continue;
    const label = cleanCatalogText(spec.label, 1, 40);
    const value = cleanCatalogText(spec.value, 1, 160);
    if (!label || !value) return { ok: false, message: "هر ویژگی محصول به نام و مقدار معتبر نیاز دارد." };
    specs.push({ label, value });
  }
  const oilFinder = input.oilFinder && (input.oilFinder.intendedUse.length || input.oilFinder.texture || input.oilFinder.scent)
    ? { intendedUse: [...new Set(input.oilFinder.intendedUse)], texture: input.oilFinder.texture, scent: input.oilFinder.scent }
    : null;
  if (input.variants.length < 1 || input.variants.length > 8) {
    return { ok: false, message: "هر محصول بین ۱ تا ۸ بسته دارد." };
  }
  const variants: ParsedVariant[] = [];
  const skus = new Set<string>([sku]);
  for (const variant of input.variants) {
    const variantSku = normalizeSku(variant.sku);
    const label = cleanCatalogText(variant.label, 1, 40);
    if (!variantSku || !label) return { ok: false, message: "برچسب و کد هر بسته لازم است." };
    if (skus.has(variantSku)) return { ok: false, message: "کد بسته‌ها نباید تکراری باشد." };
    skus.add(variantSku);
    const price = parseToman(variant.priceToman);
    if (!price.ok) return price;
    let compareAtIrr: number | null = null;
    if (variant.compareAtToman !== null) {
      const compare = parseToman(variant.compareAtToman);
      if (!compare.ok) return compare;
      if (compare.irr <= price.irr) return { ok: false, message: "قیمت قبل از تخفیف باید از قیمت فروش بیشتر باشد." };
      compareAtIrr = compare.irr;
    }
    let amount: number | null = null;
    if (variant.unitKind === "custom") amount = null;
    else if (!Number.isInteger(variant.amount) || (variant.amount ?? 0) < 1 || (variant.amount ?? 0) > 100_000) {
      return { ok: false, message: "مقدار حجم یا وزن باید عدد صحیح مثبت باشد." };
    } else amount = variant.amount;
    const openingOnHand = variant.id ? 0 : (variant.openingOnHand ?? 0);
    if (!variant.id && (!Number.isInteger(openingOnHand) || openingOnHand < 0 || openingOnHand > 100_000)) {
      return { ok: false, message: "موجودی اولیه بسته تازه معتبر نیست." };
    }
    variants.push({
      id: variant.id,
      sku: variantSku,
      label,
      unitKind: variant.unitKind,
      amount,
      priceIrr: price.irr,
      compareAtIrr,
      isDefault: variant.isDefault,
      status: variant.status,
      openingOnHand,
    });
  }
  const activeCount = variants.filter((variant) => variant.status === "active").length;
  if (input.status === "published" && !canPublish(activeCount)) {
    return { ok: false, message: "محصول منتشرشده حداقل یک بسته فعال می‌خواهد." };
  }
  return {
    ok: true,
    value: {
      id: input.id,
      categoryId: input.categoryId,
      name,
      englishName: englishName ?? "",
      subtitle: subtitle ?? "",
      homepageTitle,
      homepageSubtitle: homepageSubtitle ?? "",
      slug,
      sku,
      status: input.status,
      shortDescription: shortDescription ?? "",
      fullDescription: fullDescription ?? "",
      origin: origin ?? "",
      ingredients: ingredients ?? "",
      usageInstructions: usageInstructions ?? "",
      storageInstructions: storageInstructions ?? "",
      seoTitle: seoTitle ?? "",
      seoDescription: seoDescription ?? "",
      oilFinder,
      specs,
      isOrganic: input.isOrganic,
      isBestSeller: input.isBestSeller,
      isFeatured: input.isFeatured,
      imageUrl,
      variants,
    },
  };
}

async function writePrimaryImage(
  tx: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
  productId: string,
  imageUrl: string,
): Promise<void> {
  const rows = await tx.select().from(productImages).where(and(eq(productImages.productId, productId), eq(productImages.isPrimary, true)));
  if (!imageUrl) {
    if (rows[0]) await tx.delete(productImages).where(eq(productImages.id, rows[0].id));
    return;
  }
  const [candidate] = await tx
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.publicUrl, imageUrl), isNull(mediaAssets.deletedAt)))
    .limit(1);
  // Lock the asset row before linking so a concurrent retireMedia cannot pass its in-use check.
  const linked = candidate ? await lockLiveMediaAsset(tx, candidate.id) : null;
  const mediaId = linked?.id ?? null;
  if (rows[0]) {
    await tx.update(productImages).set({ url: imageUrl, alt: rows[0].alt, mediaId }).where(eq(productImages.id, rows[0].id));
    return;
  }
  await tx.insert(productImages).values({
    id: `img-${crypto.randomUUID()}`,
    productId,
    mediaId,
    url: imageUrl,
    alt: "",
    isPrimary: true,
    sortOrder: 1,
  });
}

class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

function fail(error: unknown): CatalogResult {
  if (error instanceof SessionError || error instanceof CatalogError) return { ok: false, message: error.message };
  if (isUniqueViolation(error)) return { ok: false, message: "شناسه یا کد کالا تکراری است." };
  throw error;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === "object" && current && "code" in current && (current as { code?: unknown }).code === "23505") return true;
    if (current instanceof Error) {
      if (/duplicate key|unique constraint|23505/i.test(current.message)) return true;
      current = current.cause;
      continue;
    }
    break;
  }
  return false;
}
