import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { hasUnsafeText } from "@/lib/text-safety";
import { writeAudit } from "../auth/audit";
import { openDb } from "../auth/db";
import { requireAdmin, requireCustomer, SessionError } from "../auth/guard";
import type { AppDatabase } from "../db/client";
import { customers, orderItems, orders, productVariants, products, reviews } from "../db/schema";

export type PublicReview = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function cleanBody(value: string): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 8 || text.length > 800 || hasUnsafeText(text)) return null;
  return text;
}

async function boughtProduct(db: AppDatabase, customerId: string, productId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orders.paymentStatus, "verified"),
        eq(productVariants.productId, productId),
        inArray(orders.status, ["paid", "processing", "ready_to_ship", "shipped", "delivered"]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function approvedReviews(db: AppDatabase, productId: string): Promise<PublicReview[]> {
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "approved"), eq(reviews.isSample, false)))
    .orderBy(desc(reviews.createdAt))
    .limit(20);
  return rows.map((row) => ({
    id: row.id,
    authorName: row.authorName,
    rating: row.rating,
    body: row.body,
    verifiedPurchase: row.verifiedPurchase,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

export async function submitReview(db: AppDatabase, customerId: string, authorName: string, productId: string, rating: number, body: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false as const, message: "امتیاز باید بین ۱ تا ۵ باشد." };
  const text = cleanBody(body);
  if (!text) return { ok: false as const, message: "متن نظر را بین ۸ تا ۸۰۰ نویسه و بدون علامت نامعتبر بنویسید." };
  const [product] = await db.select({ id: products.id, status: products.status }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product || product.status !== "published") return { ok: false as const, message: "این محصول برای نظر باز نیست." };
  const since = new Date(Date.now() - DAY_MS);
  const recent = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.customerId, customerId), gte(reviews.createdAt, since)));
  if (recent.length >= 3) return { ok: false as const, message: "امروز به سقف ثبت نظر رسیده‌اید." };
  const [live] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.customerId, customerId), eq(reviews.productId, productId), inArray(reviews.status, ["pending", "approved"])))
    .limit(1);
  if (live) return { ok: false as const, message: "برای این محصول قبلاً نظر باز دارید." };
  const verified = await boughtProduct(db, customerId, productId);
  const id = `rev-${crypto.randomUUID()}`;
  await db.insert(reviews).values({
    id,
    productId,
    customerId,
    authorName: authorName.trim() || "مشتری شاهو",
    rating,
    body: text,
    status: "pending",
    isSample: false,
    verifiedPurchase: verified,
  });
  await writeAudit(db, {
    actorType: "customer",
    actorId: customerId,
    action: "review.submitted",
    entityType: "review",
    entityId: id,
    metadata: { productId, rating },
  });
  return { ok: true as const, message: "نظر ثبت شد و تا تأیید مدیر نمایش داده نمی‌شود." };
}

export async function moderateReview(db: AppDatabase, actorId: string, id: string, action: "approve" | "reject" | "delete") {
  const [row] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!row || row.isSample) return { ok: false as const, message: "نظر پیدا نشد." };
  if (action === "delete") {
    await db.delete(reviews).where(eq(reviews.id, id));
  } else {
    await db
      .update(reviews)
      .set({ status: action === "approve" ? "approved" : "rejected", updatedAt: new Date() })
      .where(eq(reviews.id, id));
  }
  await writeAudit(db, {
    actorType: "admin",
    actorId,
    action: `review.${action}`,
    entityType: "review",
    entityId: id,
    metadata: {},
  });
  return { ok: true as const };
}

export async function listModerationQueue(db: AppDatabase) {
  return db
    .select({
      id: reviews.id,
      productName: products.name,
      authorName: reviews.authorName,
      rating: reviews.rating,
      body: reviews.body,
      status: reviews.status,
      verifiedPurchase: reviews.verifiedPurchase,
    })
    .from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .where(eq(reviews.isSample, false))
    .orderBy(desc(reviews.createdAt))
    .limit(50);
}

export async function submitReviewForSession(productId: string, rating: number, body: string) {
  try {
    const { db, customer } = await requireCustomer();
    const [profile] = await db.select({ fullName: customers.fullName }).from(customers).where(eq(customers.id, customer.id)).limit(1);
    return await submitReview(db, customer.id, profile?.fullName || "مشتری شاهو", productId, rating, body);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    if (String(error).includes("reviews_live_customer_product")) return { ok: false as const, message: "برای این محصول قبلاً نظر باز دارید." };
    return { ok: false as const, message: "ثبت نظر انجام نشد." };
  }
}

export async function moderateReviewForAdmin(id: string, action: "approve" | "reject" | "delete") {
  try {
    const { db, admin } = await requireAdmin("catalog.write");
    return await moderateReview(db, admin.id, id, action);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "تغییر نظر انجام نشد." };
  }
}

export async function reviewQueueForAdmin() {
  try {
    const { db } = await requireAdmin("catalog.read");
    return { ok: true as const, rows: await listModerationQueue(db) };
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message, rows: [] };
    return { ok: false as const, message: "فهرست نظرها خوانده نشد.", rows: [] };
  }
}

export async function productReviews(productId: string) {
  const db = await openDb();
  return approvedReviews(db, productId);
}

