import { count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { FoundationReport } from "@/lib/store-types";
import { getDb } from "../db/client";
import { ensureSeed } from "../db/seed";
import {
  articles,
  homepageSections,
  inventory,
  orders,
  productCategories,
  productVariants,
  products,
  settings,
  sitePages,
} from "../db/schema";

export async function loadFoundationReport(): Promise<FoundationReport> {
  await ensureSeed();
  const db = await getDb();
  const [productCount] = await db.select({ value: count() }).from(products);
  const [categoryCount] = await db.select({ value: count() }).from(productCategories);
  const [variantCount] = await db.select({ value: count() }).from(productVariants);
  const [sectionCount] = await db.select({ value: count() }).from(homepageSections);
  const [pageCount] = await db.select({ value: count() }).from(sitePages);
  const [articleCount] = await db.select({ value: count() }).from(articles);
  const [orderCount] = await db.select({ value: count() }).from(orders);
  const [lowStock] = await db
    .select({ value: count() })
    .from(inventory)
    .where(sql`${inventory.onHand} <= ${inventory.lowStockThreshold}`);
  const [seed] = await db.select().from(settings).where(eq(settings.key, "foundation.seed")).limit(1);
  const version = z.object({ version: z.number() }).safeParse(seed?.value);
  return {
    connected: true,
    products: productCount?.value ?? 0,
    categories: categoryCount?.value ?? 0,
    variants: variantCount?.value ?? 0,
    sections: sectionCount?.value ?? 0,
    pages: pageCount?.value ?? 0,
    articles: articleCount?.value ?? 0,
    lowStock: lowStock?.value ?? 0,
    orders: orderCount?.value ?? 0,
    seedVersion: version.success ? version.data.version : null,
  };
}
