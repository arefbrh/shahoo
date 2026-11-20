import { and, eq, isNull } from "drizzle-orm";
import { writeAudit } from "../auth/audit";
import { requireCustomer, SessionError } from "../auth/guard";
import { openDb } from "../auth/db";
import { readCustomer } from "../auth/sessions";
import type { AppDatabase } from "../db/client";
import { products, wishlistItems, wishlists } from "../db/schema";

export type SavedProduct = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
};

async function ensureList(db: AppDatabase, customerId: string): Promise<string> {
  const [existing] = await db.select().from(wishlists).where(eq(wishlists.customerId, customerId)).limit(1);
  if (existing) return existing.id;
  const id = `wish-${crypto.randomUUID()}`;
  await db.insert(wishlists).values({ id, customerId }).onConflictDoNothing();
  const [row] = await db.select().from(wishlists).where(eq(wishlists.customerId, customerId)).limit(1);
  if (!row) throw new Error("wishlist missing");
  return row.id;
}

export async function listSaved(db: AppDatabase, customerId: string): Promise<SavedProduct[]> {
  const listId = await ensureList(db, customerId);
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      status: products.status,
      deletedAt: products.deletedAt,
    })
    .from(wishlistItems)
    .innerJoin(products, eq(wishlistItems.productId, products.id))
    .where(eq(wishlistItems.wishlistId, listId));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    active: row.status === "published" && !row.deletedAt,
  }));
}

export async function toggleSaved(db: AppDatabase, customerId: string, productId: string) {
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return { ok: false as const, message: "محصول پیدا نشد." };
  const listId = await ensureList(db, customerId);
  const [item] = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.wishlistId, listId), eq(wishlistItems.productId, productId)))
    .limit(1);
  if (item) {
    await db.delete(wishlistItems).where(and(eq(wishlistItems.wishlistId, listId), eq(wishlistItems.productId, productId)));
  } else {
    await db.insert(wishlistItems).values({ wishlistId: listId, productId }).onConflictDoNothing();
  }
  return { ok: true as const, items: await listSaved(db, customerId) };
}

export async function mergeSaved(db: AppDatabase, customerId: string, productIds: string[]) {
  const listId = await ensureList(db, customerId);
  const unique = [...new Set(productIds)].slice(0, 40);
  for (const productId of unique) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);
    if (!product) continue;
    await db.insert(wishlistItems).values({ wishlistId: listId, productId }).onConflictDoNothing();
  }
  await writeAudit(db, {
    actorType: "customer",
    actorId: customerId,
    action: "wishlist.merged",
    entityType: "wishlist",
    entityId: listId,
    metadata: { count: unique.length },
  });
  return { ok: true as const, items: await listSaved(db, customerId) };
}

export async function wishlistForSession() {
  const db = await openDb();
  const customer = await readCustomer(db);
  if (!customer) return { mode: "guest" as const, items: [] as SavedProduct[] };
  return { mode: "account" as const, items: await listSaved(db, customer.id) };
}

export async function toggleWishlistForSession(productId: string) {
  try {
    const { db, customer } = await requireCustomer();
    const result = await toggleSaved(db, customer.id, productId);
    if (!result.ok) return result;
    return { mode: "account" as const, items: result.items };
  } catch (error) {
    if (error instanceof SessionError) return { mode: "guest" as const, items: [] as SavedProduct[] };
    return { ok: false as const, message: "ذخیره علاقه‌مندی انجام نشد." };
  }
}

export async function mergeWishlistForSession(productIds: string[]) {
  try {
    const { db, customer } = await requireCustomer();
    const result = await mergeSaved(db, customer.id, productIds);
    return { mode: "account" as const, items: result.items };
  } catch (error) {
    if (error instanceof SessionError) return { mode: "guest" as const, items: [] as SavedProduct[] };
    return { ok: false as const, message: "انتقال علاقه‌مندی انجام نشد." };
  }
}
