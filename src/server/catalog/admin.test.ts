import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { saveProductWithAdmin, parseProduct } from "./admin.ts";
import type { AdminPrincipal } from "../auth/sessions.ts";
import * as schema from "../db/schema.ts";
import { auditLogs, inventory, productCategories, productSpecs, productVariants, products } from "../db/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const base = {
  categoryId: "cat-oils",
  name: "روغن نمونه",
  englishName: "",
  subtitle: "",
  homepageTitle: "روغن نمونه",
  homepageSubtitle: "",
  slug: "sample-oil",
  sku: "SAMPLE-OIL",
  status: "draft" as const,
  shortDescription: "",
  fullDescription: "",
  origin: "",
  ingredients: "",
  usageInstructions: "",
  storageInstructions: "",
  seoTitle: "",
  seoDescription: "",
  oilFinder: null,
  specs: [],
  isOrganic: false,
  isBestSeller: false,
  isFeatured: false,
  imageUrl: "",
};

const admin: AdminPrincipal = {
  id: "admin-test",
  fullName: "مدیر آزمون",
  email: null,
  mobile: null,
  sessionId: "admin-session-test",
  roles: [],
  permissions: ["catalog.write", "inventory.write"],
};

function variant(overrides: Partial<Parameters<typeof parseProduct>[0]["variants"][number]> = {}) {
  return {
    sku: "SAMPLE-OIL-250",
    label: "بسته ۲۵۰ میلی‌لیتر",
    unitKind: "volume" as const,
    amount: 250,
    priceToman: 125000,
    compareAtToman: null,
    isDefault: true,
    status: "active" as const,
    ...overrides,
  };
}

async function database() {
  const pg = new PGlite();
  await pg.waitReady;
  const migrations = readdirSync(join(root, "migrations")).filter((name) => name.endsWith(".sql")).sort();
  for (const migration of migrations) {
    await pg.exec(readFileSync(join(root, "migrations", migration), "utf8"));
  }
  const db = drizzle(pg, { schema });
  await db.insert(productCategories).values({ id: "cat-oils", slug: "oils", name: "روغن", shortName: "روغن" });
  return db;
}

test("product parser keeps owner-supplied optional fields empty and accepts a valid volume variant", () => {
  const parsed = parseProduct({ ...base, variants: [variant()] });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.englishName, "");
  assert.equal(parsed.value.origin, "");
  assert.equal(parsed.value.ingredients, "");
  assert.equal(parsed.value.oilFinder, null);
  assert.deepEqual(parsed.value.specs, []);
  assert.equal(parsed.value.variants[0]?.amount, 250);
  assert.equal(parsed.value.variants[0]?.unitKind, "volume");
});

test("product parser preserves custom-unit variants and owner-entered specifications", () => {
  const parsed = parseProduct({
    ...base,
    origin: "اطلاعات درج‌شده توسط مالک",
    specs: [{ label: "روش پرس", value: "پرس سرد" }],
    oilFinder: { intendedUse: ["skin", "hair"], texture: "light", scent: "mild" },
    variants: [variant({ unitKind: "custom", amount: null, label: "بسته ویژه", sku: "SAMPLE-OIL-CUSTOM" })],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.origin, "اطلاعات درج‌شده توسط مالک");
  assert.deepEqual(parsed.value.specs, [{ label: "روش پرس", value: "پرس سرد" }]);
  assert.deepEqual(parsed.value.oilFinder?.intendedUse, ["skin", "hair"]);
  assert.equal(parsed.value.variants[0]?.amount, null);
  assert.equal(parsed.value.variants[0]?.unitKind, "custom");
});

test("product parser rejects conflicting SKUs, invalid amounts and incomplete specifications", () => {
  assert.equal(parseProduct({ ...base, variants: [variant({ sku: "SAMPLE-OIL" })] }).ok, false);
  assert.equal(parseProduct({ ...base, variants: [variant({ amount: 0 })] }).ok, false);
  assert.equal(parseProduct({ ...base, specs: [{ label: "منشأ", value: "" }], variants: [variant()] }).ok, false);
});

test("product create and edit persist entered content and specs while preserving variant stock and history", async () => {
  const db = await database();
  const created = await saveProductWithAdmin(db, admin, {
    ...base,
    specs: [{ label: "روش پرس", value: "پرس سرد" }],
    variants: [variant()],
  });
  assert.equal(created.ok, true);
  const [product] = await db.select().from(products).where(eq(products.slug, "sample-oil"));
  assert.ok(product);
  const [savedVariant] = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
  assert.ok(savedVariant);
  const [stockBefore] = await db.select().from(inventory).where(eq(inventory.variantId, savedVariant.id));
  assert.ok(stockBefore);
  assert.equal(stockBefore.onHand, 0);
  assert.deepEqual((await db.select().from(productSpecs).where(eq(productSpecs.productId, product.id))).map(({ label, value }) => ({ label, value })), [
    { label: "روش پرس", value: "پرس سرد" },
  ]);

  const edited = await saveProductWithAdmin(db, admin, {
    ...base,
    id: product.id,
    name: "روغن ویرایش‌شده",
    homepageTitle: "عنوان خانه واردشده",
    shortDescription: "خلاصه واردشده",
    origin: "منشأ واردشده توسط مدیر",
    seoTitle: "عنوان سئو واردشده",
    seoDescription: "شرح سئو واردشده",
    isFeatured: true,
    specs: [{ label: "روش استخراج", value: "اطلاعات مالک" }],
    variants: [variant({ id: savedVariant.id, priceToman: 150000 })],
  });
  assert.equal(edited.ok, true);
  const [afterEdit] = await db.select().from(products).where(eq(products.id, product.id));
  assert.equal(afterEdit?.name, "روغن ویرایش‌شده");
  assert.equal(afterEdit?.homepageTitle, "عنوان خانه واردشده");
  assert.equal(afterEdit?.origin, "منشأ واردشده توسط مدیر");
  assert.equal(afterEdit?.seoTitle, "عنوان سئو واردشده");
  assert.equal(afterEdit?.seoDescription, "شرح سئو واردشده");
  assert.equal(afterEdit?.isFeatured, true);
  const [updatedVariant] = await db.select().from(productVariants).where(eq(productVariants.id, savedVariant.id));
  assert.equal(updatedVariant?.priceIrr, 1500000);
  const [stockAfter] = await db.select().from(inventory).where(eq(inventory.variantId, savedVariant.id));
  assert.equal(stockAfter?.onHand, stockBefore.onHand);
  assert.deepEqual((await db.select().from(productSpecs).where(eq(productSpecs.productId, product.id))).map(({ label, value }) => ({ label, value })), [
    { label: "روش استخراج", value: "اطلاعات مالک" },
  ]);

  const omittedHistoricalVariant = await saveProductWithAdmin(db, admin, {
    ...base,
    id: product.id,
    name: "نباید ذخیره شود",
    slug: "sample-oil",
    sku: "SAMPLE-OIL",
    variants: [variant({ sku: "SAMPLE-OIL-NEW" })],
  });
  assert.equal(omittedHistoricalVariant.ok, false);
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, savedVariant.id))).length, 1);
  assert.equal((await db.select().from(auditLogs).where(eq(auditLogs.action, "catalog.product_saved"))).length, 2);
});

test("product save service refuses an admin principal without catalog.write", async () => {
  const db = await database();
  const denied = await saveProductWithAdmin(db, { ...admin, permissions: [] }, { ...base, variants: [variant()] });
  assert.equal(denied.ok, false);
  assert.equal((await db.select().from(products)).length, 0);
});
