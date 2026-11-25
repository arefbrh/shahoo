import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { irrToToman } from "../../lib/money";
import { getDb } from "../db/client";
import { inventory, productCategories, productImages, productVariants, products } from "../db/schema";
import { requestOrigin } from "./origin";

export interface TorobProductItem {
  page_unique_code: string;
  title: string;
  subtitle: string;
  page_url: string;
  price: number;
  current_price: number;
  old_price: number;
  availability: "instock" | "outofstock";
  image_links: string[];
  category_name: string;
  spec: Record<string, string>;
}

export interface TorobFeedResponse {
  count: number;
  products: TorobProductItem[];
}

/**
 * Public product feed. Reads the same active variant and available-stock
 * records as the storefront; it does not seed or mutate catalog data.
 */
export async function generateTorobProductFeed(): Promise<TorobFeedResponse> {
  const db = await getDb();
  const origin = requestOrigin();
  if (!origin) throw new Error("public_origin_unconfigured");

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productSubtitle: products.subtitle,
      slug: products.slug,
      categoryName: productCategories.name,
      variantId: productVariants.id,
      variantLabel: productVariants.label,
      sku: productVariants.sku,
      priceIrr: productVariants.priceIrr,
      compareAtPriceIrr: productVariants.compareAtPriceIrr,
      availableQuantity: sql<number>`(${inventory.onHand} - ${inventory.reserved})`.mapWith(Number),
      unit: productVariants.unitKind,
      imageUrl: productImages.url,
    })
    .from(products)
    .innerJoin(productCategories, and(
      eq(productCategories.id, products.categoryId),
      eq(productCategories.isActive, true),
      isNull(productCategories.deletedAt),
    ))
    .innerJoin(productVariants, and(
      eq(productVariants.productId, products.id),
      eq(productVariants.status, "active"),
      isNull(productVariants.deletedAt),
    ))
    .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .leftJoin(productImages, and(
      eq(productImages.productId, products.id),
      eq(productImages.isPrimary, true),
    ))
    .where(and(
      eq(products.status, "published"),
      isNull(products.deletedAt),
      gt(productVariants.priceIrr, 0),
    ));

  const items: TorobProductItem[] = rows.map((row) => {
    const currentPrice = irrToToman(Number(row.priceIrr));
    const comparePrice = row.compareAtPriceIrr == null
      ? currentPrice
      : irrToToman(Number(row.compareAtPriceIrr));
    const oldPrice = comparePrice > currentPrice ? comparePrice : currentPrice;
    const imageLinks = row.imageUrl
      ? [row.imageUrl.startsWith("http")
          ? row.imageUrl
          : `${origin}${row.imageUrl.startsWith("/") ? "" : "/"}${row.imageUrl}`]
      : [];

    const spec: Record<string, string> = { "برند": "شاهو (SHAHOO)" };
    if (row.unit) spec["واحد"] = row.unit;

    return {
      page_unique_code: row.sku || `${row.productId}_${row.variantId}`,
      title: `${row.productName}${row.variantLabel ? ` (${row.variantLabel})` : ""} - شاهو`,
      subtitle: row.productSubtitle || "محصولات طبیعی شاهو",
      page_url: `${origin}/product/${encodeURIComponent(row.slug)}`,
      price: currentPrice,
      current_price: currentPrice,
      old_price: oldPrice,
      availability: Number(row.availableQuantity) > 0 ? "instock" : "outofstock",
      image_links: imageLinks,
      category_name: row.categoryName,
      spec,
    };
  });

  return { count: items.length, products: items };
}
