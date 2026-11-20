import { sanitizeImage } from "./sanitize-image.ts";
import { writeAudit } from "../auth/audit.ts";
import { requireAdmin, SessionError } from "../auth/guard.ts";
import type { AppDatabase } from "../db/client";
import { mediaAssets, productImages, products } from "../db/schema.ts";
import { and, eq, isNull } from "drizzle-orm";
import { openStorage } from "./disk.ts";
import { lockLiveMediaAsset } from "./lock.ts";

export {
  LocalDiskStorage,
  S3ObjectStorage,
  localMediaDir,
  localObjectName,
  objectNameForStorageKey,
  openStorage,
  type ObjectStorage,
} from "./disk.ts";

export async function storeUploadedImage(db: AppDatabase, actorId: string, bytes: Uint8Array, alt: string) {
  const clean = sanitizeImage(bytes);
  if (!clean) return { ok: false as const, message: "فقط تصویر JPEG، PNG یا GIF سالم تا ۴ مگابایت و ۴۰۹۶ پیکسل پذیرفته می‌شود." };
  const storage = openStorage();
  if (!storage) return { ok: false as const, message: "فضای ذخیره فایل تنظیم نشده است. نشانی ابری ساخته نمی‌شود." };
  const id = `med-${crypto.randomUUID()}`;
  const name = `${id}.${clean.ext}`;
  try {
    await storage.put(name, clean.bytes);
  } catch {
    return { ok: false as const, message: "ذخیره فایل در این محیط ممکن نیست." };
  }
  const safeAlt = alt.trim().replace(/\s+/g, " ").slice(0, 120);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(mediaAssets).values({
        id,
        folder: "library",
        filename: name,
        mimeType: clean.mime,
        byteSize: clean.bytes.length,
        alt: safeAlt,
        storageKey: storage.storageKey(name),
        publicUrl: `/media/file/${id}`,
      });
      await writeAudit(tx, {
        actorType: "admin",
        actorId,
        action: "content.media_uploaded",
        entityType: "media_asset",
        entityId: id,
        metadata: { mime: clean.mime, bytes: clean.bytes.length },
      });
    });
  } catch (error) {
    await storage.remove(name);
    throw error;
  }
  return { ok: true as const, id, publicUrl: `/media/file/${id}` };
}

export async function attachMediaToProduct(db: AppDatabase, actorId: string, productId: string, mediaId: string, primary: boolean) {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .for("update")
      .limit(1);
    const media = await lockLiveMediaAsset(tx, mediaId);
    if (!product || !media) return { ok: false as const, message: "محصول یا تصویر پیدا نشد." };
    const [existing] = await tx
      .select()
      .from(productImages)
      .where(and(eq(productImages.productId, productId), eq(productImages.mediaId, mediaId)))
      .limit(1);
    if (primary) await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
    if (existing) {
      await tx.update(productImages).set({
        isPrimary: primary ? true : existing.isPrimary,
        url: media.publicUrl,
        alt: media.alt,
        sortOrder: primary ? 0 : existing.sortOrder,
      }).where(eq(productImages.id, existing.id));
    } else {
      await tx.insert(productImages).values({
        id: `img-${crypto.randomUUID()}`,
        productId,
        mediaId,
        url: media.publicUrl,
        alt: media.alt,
        isPrimary: primary,
        sortOrder: primary ? 0 : 10,
      });
    }
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "catalog.image_attached",
      entityType: "product",
      entityId: productId,
      metadata: { mediaId, primary },
    });
    return { ok: true as const };
  });
}

/** Point a product image at another asset. The previous file is not deleted here. */
export async function replaceProductMediaLink(db: AppDatabase, actorId: string, imageId: string, mediaId: string) {
  return db.transaction(async (tx) => {
    const [image] = await tx.select().from(productImages).where(eq(productImages.id, imageId)).for("update").limit(1);
    const media = await lockLiveMediaAsset(tx, mediaId);
    if (!image || !media) return { ok: false as const, message: "محصول یا تصویر پیدا نشد." };
    const previousMediaId = image.mediaId;
    await tx.update(productImages).set({ mediaId: media.id, url: media.publicUrl, alt: media.alt }).where(eq(productImages.id, image.id));
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "catalog.image_replaced",
      entityType: "product",
      entityId: image.productId,
      metadata: { imageId, mediaId: media.id, previousMediaId },
    });
    return { ok: true as const, previousMediaId };
  });
}

export async function detachProductImage(db: AppDatabase, actorId: string, imageId: string) {
  return db.transaction(async (tx) => {
    const [image] = await tx.select().from(productImages).where(eq(productImages.id, imageId)).for("update").limit(1);
    if (!image) return { ok: false as const, message: "تصویر پیدا نشد." };
    await tx.select().from(products).where(eq(products.id, image.productId)).for("update").limit(1);
    if (image.isPrimary) return { ok: false as const, message: "تصویر اصلی را فقط با انتخاب تصویر دیگر عوض کنید." };
    await tx.delete(productImages).where(eq(productImages.id, image.id));
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "catalog.image_detached",
      entityType: "product",
      entityId: image.productId,
      metadata: { imageId },
    });
    return { ok: true as const };
  });
}

export async function reorderProductImages(db: AppDatabase, actorId: string, productId: string, ids: string[]) {
  if (ids.length > 20 || new Set(ids).size !== ids.length) return { ok: false as const, message: "ترتیب تصاویر معتبر نیست." };
  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, productId), isNull(products.deletedAt))).for("update").limit(1);
    if (!product) return { ok: false as const, message: "محصول پیدا نشد." };
    const rows = await tx.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId)).for("update");
    if (rows.length !== ids.length || rows.some((row) => !ids.includes(row.id))) {
      return { ok: false as const, message: "فهرست تصاویر تغییر کرده است؛ صفحه را تازه کنید." };
    }
    for (const [index, id] of ids.entries()) {
      await tx.update(productImages).set({ sortOrder: index + 1 }).where(and(eq(productImages.id, id), eq(productImages.productId, productId)));
    }
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "catalog.images_reordered",
      entityType: "product",
      entityId: productId,
      metadata: { count: ids.length },
    });
    return { ok: true as const };
  });
}

export async function uploadForAdmin(bytes: Uint8Array, alt: string) {
  try {
    const { db, admin } = await requireAdmin("content.write");
    return await storeUploadedImage(db, admin.id, bytes, alt);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "بارگذاری انجام نشد." };
  }
}

export async function attachForAdmin(productId: string, mediaId: string, primary: boolean) {
  try {
    const { db, admin } = await requireAdmin("catalog.write");
    return await attachMediaToProduct(db, admin.id, productId, mediaId, primary);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "اتصال تصویر انجام نشد." };
  }
}

export async function detachForAdmin(imageId: string) {
  try {
    const { db, admin } = await requireAdmin("catalog.write");
    return await detachProductImage(db, admin.id, imageId);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "برداشتن تصویر انجام نشد." };
  }
}

export async function reorderForAdmin(productId: string, ids: string[]) {
  try {
    const { db, admin } = await requireAdmin("catalog.write");
    return await reorderProductImages(db, admin.id, productId, ids);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "ترتیب تصاویر ذخیره نشد." };
  }
}
