import { and, eq, isNull, or } from "drizzle-orm";
import type { AppDatabase } from "../db/client";
import { articles, banners, mediaAssets, opsDiagnostics, productImages } from "../db/schema.ts";
import { objectNameForStorageKey, openStorage, type ObjectStorage } from "./disk.ts";

/**
 * Media reference safety (Batch 02 correction).
 *
 * Rule: the `media_assets` row is the single serialization point.
 *  - Every operation that WRITES a reference to an asset (product image attach /
 *    replace / link, banner desktop/mobile, article cover) first calls
 *    `lockLiveMediaAsset`, which takes `SELECT ... FOR UPDATE` on the asset row
 *    and requires `deleted_at IS NULL`.
 *  - `retireMedia` takes the same lock before it checks `mediaInUse` and before it
 *    soft-deletes.
 * Both orders are therefore safe: attach-first makes retire see the reference and
 * refuse; retire-first commits `deleted_at`, and the waiting attach then finds no
 * live asset and refuses. A soft-deleted asset can never become live again.
 *
 * The file is only removed AFTER the transaction that soft-deleted the row has
 * committed, so a rolled-back transaction can never lose a file.
 */
type Tx = AppDatabase;

export async function lockLiveMediaAsset(tx: Tx, id: string) {
  const [row] = await tx
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
    .for("update")
    .limit(1);
  return row ?? null;
}

/** All FK references to media_assets: banners (desktop/mobile), live articles (cover), product images. */
export async function mediaInUse(tx: Tx, id: string): Promise<boolean> {
  const [banner] = await tx
    .select({ id: banners.id })
    .from(banners)
    .where(or(eq(banners.desktopMediaId, id), eq(banners.mobileMediaId, id)))
    .limit(1);
  if (banner) return true;
  const [article] = await tx
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.coverMediaId, id), isNull(articles.deletedAt)))
    .limit(1);
  if (article) return true;
  const [image] = await tx.select({ id: productImages.id }).from(productImages).where(eq(productImages.mediaId, id)).limit(1);
  return Boolean(image);
}

export const FILE_CLEANUP_KIND = "media.file_cleanup";

/** Remove the file of an already soft-deleted asset; on failure leave a pending diagnostic. */
export async function removeFileOrRecord(
  db: AppDatabase,
  id: string,
  objectName: string,
  storage: ObjectStorage | null = openStorage(),
): Promise<boolean> {
  try {
    if (!storage) throw new Error("storage_unavailable");
    await storage.remove(objectName);
    return true;
  } catch {
    try {
      await db.insert(opsDiagnostics).values({
        id: `diag-${crypto.randomUUID()}`,
        kind: FILE_CLEANUP_KIND,
        entityType: "media_asset",
        entityId: id,
        message: "فایل رسانه پس از حذف رکورد پاک نشد؛ فایل دیگر از سایت منتشر نمی‌شود.",
        metadata: {},
      });
    } catch {
      // The asset is already unpublished; an orphan file is harmless and never served.
    }
    return false;
  }
}

/** Retry pending cleanup only when the currently configured adapter owns the asset key. */
export async function retryPendingMediaCleanup(
  db: AppDatabase,
  storage: ObjectStorage | null = openStorage(),
): Promise<{ removed: number; skipped: number; failed: number }> {
  const out = { removed: 0, skipped: 0, failed: 0 };
  const pending = await db.select().from(opsDiagnostics).where(eq(opsDiagnostics.kind, FILE_CLEANUP_KIND));
  for (const diag of pending) {
    const meta = (diag.metadata ?? {}) as { resolvedAt?: string };
    if (meta.resolvedAt || !diag.entityId) continue;
    const assetId = diag.entityId;
    let name: string | null = null;
    let providerMismatch = false;
    await db.transaction(async (tx) => {
      const [asset] = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).for("update").limit(1);
      if (asset && asset.deletedAt && !(await mediaInUse(tx, assetId))) {
        name = objectNameForStorageKey(asset.storageKey);
        if (name && storage?.storageKey(name) !== asset.storageKey) {
          providerMismatch = true;
          name = null;
        }
      }
      if (!name && !providerMismatch) {
        await tx
          .update(opsDiagnostics)
          .set({ metadata: { resolvedAt: new Date().toISOString(), outcome: "skipped" } })
          .where(eq(opsDiagnostics.id, diag.id));
        out.skipped += 1;
      }
    });
    if (!name) continue;
    try {
      if (!storage) throw new Error("storage_unavailable");
      await storage.remove(name);
      await db
        .update(opsDiagnostics)
        .set({ metadata: { resolvedAt: new Date().toISOString(), outcome: "removed" } })
        .where(eq(opsDiagnostics.id, diag.id));
      out.removed += 1;
    } catch {
      out.failed += 1;
    }
  }
  return out;
}
