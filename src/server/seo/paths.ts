import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { ensureSeed } from "../db/seed";
import { articles, products, sitePages } from "../db/schema";

const FIXED = ["/", "/products", "/magazine", "/oil-guide", "/contact"];

export async function publicPaths(): Promise<string[]> {
  await ensureSeed();
  const db = await getDb();
  const [productRows, articleRows, pageRows] = await Promise.all([
    db
      .select({ slug: products.slug })
      .from(products)
      .where(and(eq(products.status, "published"), isNull(products.deletedAt))),
    db
      .select({ slug: articles.slug })
      .from(articles)
      .where(and(eq(articles.status, "published"), isNull(articles.deletedAt))),
    db.select({ slug: sitePages.slug }).from(sitePages).where(eq(sitePages.isPublished, true)),
  ]);
  return [
    ...FIXED,
    ...pageRows.map((row) => `/${row.slug}`),
    ...productRows.map((row) => `/product/${row.slug}`),
    ...articleRows.map((row) => `/magazine/${row.slug}`),
  ];
}
