import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  inventory,
  oilProductLinks,
  productCategories,
  products,
  productVariants,
} from "@/server/db/schema";

export type OilGuideCommerceStatus = {
  availability: "not_mapped" | "available" | "out_of_stock" | "unavailable";
  productHref: string | null;
};

/**
 * Commerce is deliberately resolved after encyclopedia ranking. This lookup
 * cannot add, remove or reorder recommendation candidates.
 */
export async function readOilGuideCommerceAvailability(
  oilIds: string[],
): Promise<Map<string, OilGuideCommerceStatus>> {
  const uniqueIds = [...new Set(oilIds.filter(Boolean))];
  const result = new Map<string, OilGuideCommerceStatus>(
    uniqueIds.map((oilId) => [oilId, { availability: "not_mapped", productHref: null }]),
  );
  if (!uniqueIds.length) return result;

  const db = await getDb();
  const rows = await db
    .select({
      oilId: oilProductLinks.oilId,
      productSlug: products.slug,
      productStatus: products.status,
      productDeletedAt: products.deletedAt,
      categoryActive: productCategories.isActive,
      categoryDeletedAt: productCategories.deletedAt,
      variantStatus: productVariants.status,
      variantDeletedAt: productVariants.deletedAt,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
    })
    .from(oilProductLinks)
    .leftJoin(products, eq(products.id, oilProductLinks.productId))
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .leftJoin(
      productVariants,
      and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)),
    )
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(
      and(
        inArray(oilProductLinks.oilId, uniqueIds),
        eq(oilProductLinks.mappingStatus, "approved"),
      ),
    );

  for (const row of rows) {
    const canOpenProduct = Boolean(
      row.productSlug &&
      row.productStatus === "published" &&
      !row.productDeletedAt &&
      row.categoryActive === true &&
      !row.categoryDeletedAt &&
      row.variantStatus === "active" &&
      !row.variantDeletedAt,
    );
    const inStock = canOpenProduct && Math.max((row.onHand ?? 0) - (row.reserved ?? 0), 0) > 0;
    result.set(row.oilId, {
      availability: !canOpenProduct ? "unavailable" : inStock ? "available" : "out_of_stock",
      productHref: canOpenProduct ? "/product/" + row.productSlug : null,
    });
  }
  return result;
}
