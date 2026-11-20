import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { eq } from "drizzle-orm";
import { getPglite } from "@/lib/db";
import { isLineSellable } from "@/lib/commerce-integrity";
import { getDb } from "../db/client.ts";
import { seedFoundation } from "../db/seed.ts";
import { inventory, productCategories, productVariants, products } from "../db/schema.ts";
import { quoteCartWithDb } from "./api.ts";

type QuoteRow = Parameters<typeof isLineSellable>[0];

const valid: QuoteRow = {
  productStatus: "published",
  variantStatus: "active",
  productDeletedAt: null,
  categoryActive: true,
  categoryDeletedAt: null,
  productFound: true,
};

for (const [name, patch] of [
  ["unpublished product", { productStatus: "draft" }],
  ["deleted product", { productDeletedAt: new Date() }],
  ["inactive category", { categoryActive: false }],
  ["deleted category", { categoryDeletedAt: new Date() }],
  ["inactive variant", { variantStatus: "inactive" }],
  ["deleted variant", { variantStatus: "active", variantDeletedAt: new Date() }],
] as const) {
  test(`shared sellability rejects ${name}`, () => {
    assert.equal(isLineSellable({ ...valid, ...patch } as QuoteRow), false);
  });
}

test("shared sellability accepts a published product with an active, live variant and category", () => {
  assert.equal(isLineSellable(valid), true);
});

const migrationFiles = [
  "0002_shahoo_foundation.sql",
  "0003_commerce_cart.sql",
  "0004_batch_0501.sql",
  "0005_batch_0502.sql",
  "0006_completion.sql",
  "0007_media_primary.sql",
  "0008_batch_02.sql",
  "0009_batch_04_home_copy.sql",
  "0010_batch_04_home_sections.sql",
  "0011_batch_05_customer_account.sql",
  "0012_batch_07_inventory_audit.sql",
];

let integrationReady: Promise<void> | null = null;
async function prepareQuoteDatabase(): Promise<void> {
  if (integrationReady) return integrationReady;
  integrationReady = (async () => {
    const pg = await getPglite();
    for (const file of migrationFiles) {
      await pg.exec(readFileSync(join(process.cwd(), "migrations", file), "utf8"));
    }
    const db = await getDb();
    await seedFoundation(db);
    await db.insert(productCategories).values({
      id: "quote-test-category",
      slug: "quote-test-category",
      name: "Quote test",
      shortName: "Quote",
    });
    await db.insert(products).values({
      id: "quote-test-product",
      categoryId: "quote-test-category",
      slug: "quote-test-product",
      sku: "QUOTE-TEST-PRODUCT",
      name: "Quote test product",
      status: "published",
    });
    await db.insert(productVariants).values({
      id: "quote-test-variant",
      productId: "quote-test-product",
      sku: "QUOTE-TEST-VARIANT",
      label: "one",
      priceIrr: 1000,
      status: "active",
    });
    await db.insert(inventory).values({ variantId: "quote-test-variant", onHand: 5, reserved: 0 });
  })();
  return integrationReady;
}

async function invokeQuote(items: Array<{ variantId: string; quantity: number }>) {
  return quoteCartWithDb(await getDb(), { items });
}

test("quoteCart uses the database query path and keeps valid lines", async () => {
  await prepareQuoteDatabase();
  const result = await invokeQuote([{ variantId: "quote-test-variant", quantity: 2 }]);
  assert.deepEqual(result.lines.map((line) => [line.variantId, line.quantity]), [["quote-test-variant", 2]]);
  assert.equal(result.subtotalIrr, 2000);
});

test("quoteCart rejects missing variants and lines whose state changes after insertion", async () => {
  await prepareQuoteDatabase();
  const db = await getDb();
  const missing = await invokeQuote([{ variantId: "does-not-exist", quantity: 1 }]);
  assert.deepEqual(missing.lines, []);

  await db.update(productVariants).set({ status: "inactive" }).where(eq(productVariants.id, "quote-test-variant"));
  assert.deepEqual((await invokeQuote([{ variantId: "quote-test-variant", quantity: 1 }])).lines, []);
  await db.update(productVariants).set({ status: "active", deletedAt: new Date() }).where(eq(productVariants.id, "quote-test-variant"));
  assert.deepEqual((await invokeQuote([{ variantId: "quote-test-variant", quantity: 1 }])).lines, []);
  await db.update(productVariants).set({ deletedAt: null }).where(eq(productVariants.id, "quote-test-variant"));
  await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, "quote-test-product"));
  assert.deepEqual((await invokeQuote([{ variantId: "quote-test-variant", quantity: 1 }])).lines, []);
});

test("quoteCart rejects inactive and deleted categories without exposing database details", async () => {
  await prepareQuoteDatabase();
  const db = await getDb();
  await db.update(products).set({ deletedAt: null }).where(eq(products.id, "quote-test-product"));
  await db.update(productCategories).set({ isActive: false }).where(eq(productCategories.id, "quote-test-category"));
  assert.deepEqual((await invokeQuote([{ variantId: "quote-test-variant", quantity: 1 }])).lines, []);
  await db.update(productCategories).set({ isActive: true, deletedAt: new Date() }).where(eq(productCategories.id, "quote-test-category"));
  assert.deepEqual((await invokeQuote([{ variantId: "quote-test-variant", quantity: 1 }])).lines, []);
  await db.update(productCategories).set({ deletedAt: null }).where(eq(productCategories.id, "quote-test-category"));
  const result = await invokeQuote([{ variantId: "quote-test-variant", quantity: 1 }]);
  assert.equal(result.lines.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /select|relation|password|database/i);
});
