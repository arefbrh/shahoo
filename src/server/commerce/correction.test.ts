/**
 * Batch 02 correction tests: (A) stock recovery category validation,
 * (B) refund-to-payment link, (C) media reference locking and cleanup.
 *
 * These run on PGlite (single connection). They prove logic and rollback behaviour,
 * NOT race safety. Real multi-connection proof: scripts/pg-media-race.sh.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { retireMedia } from "../cms/content.ts";
import { auditLogs, inventory, inventoryLogs, opsDiagnostics, orders, payments, productImages } from "../db/schema.ts";
import * as schema from "../db/schema.ts";
import { LocalDiskStorage, type ObjectStorage } from "../media/disk.ts";
import { lockLiveMediaAsset, removeFileOrRecord, retryPendingMediaCleanup } from "../media/lock.ts";
import { attachMediaToProduct, replaceProductMediaLink } from "../media/storage.ts";
import { captureVerifiedPayment, type PaymentProvider } from "../payments/service.ts";
import { settlePaidCancel } from "./fulfillment.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const migrations = [
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

async function open() {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of migrations) await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  const db = drizzle(pg, { schema });
  await pg.exec(`
    insert into product_categories (id, slug, name, short_name, is_active) values ('cat-a', 'oils', 'روغن', 'روغن', true);
    insert into products (id, category_id, slug, sku, name, status) values ('prod-a', 'cat-a', 'prod-a', 'SKU-A', 'روغن سیاه‌دانه', 'published');
    insert into product_variants (id, product_id, sku, label, price_irr, status) values ('var-a', 'prod-a', 'SKU-A-1', '۳۰ میلی', 100000, 'active');
    insert into inventory (variant_id, on_hand, reserved, low_stock_threshold) values ('var-a', 5, 0, 1);
    insert into customers (id, mobile, full_name, status) values ('cust-a', '09120000001', 'آزاده رضایی', 'active');
    insert into admin_users (id, email, full_name, status) values ('admin-1', 'desk@example.com', 'مدیر', 'active');
  `);
  return { pg, db };
}
type Db = Awaited<ReturnType<typeof open>>["db"];

const provider: PaymentProvider = {
  key: "mock",
  configured: () => true,
  async createIntent(input) {
    return { authority: `mock-${input.idempotencyKey}` };
  },
  async verify(input) {
    if (input.token !== `mock-ok:${input.authority}`) return { ok: false, reason: "mock_rejected" };
    return { ok: true, referenceId: "ref" };
  },
};

const orderBase = {
  fullName: "آزاده",
  mobile: "09120000001",
  province: "تهران",
  city: "تهران",
  addressLine: "خیابان آزمایشی بلندتر",
  subtotalIrr: 100000,
  totalIrr: 100000,
};

async function expiredOrder(db: Db, id: string) {
  await db.insert(orders).values({
    id,
    publicCode: `SH-20261117-${id.toUpperCase()}`,
    status: "expired",
    paymentStatus: "unpaid",
    stockState: "released",
    ...orderBase,
  });
  await db.insert(schema.orderItems).values({
    id: `oi-${id}`,
    orderId: id,
    variantId: "var-a",
    productName: "روغن",
    variantLabel: "۳۰ میلی",
    sku: "SKU-A-1",
    quantity: 1,
    unitPriceIrr: 100000,
    lineTotalIrr: 100000,
  });
}

async function pay(db: Db, id: string, key: string) {
  return captureVerifiedPayment(db, { orderId: id, idempotencyKey: key, token: `mock-ok:mock-${key}`, provider });
}

async function assertNothingMutated(db: Db, id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  assert.equal(order?.status, "expired");
  assert.equal(order?.paymentStatus, "unpaid");
  assert.equal(order?.stockState, "released");
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 5);
  assert.equal(stock?.reserved, 0);
  assert.equal((await db.select().from(payments)).length, 0);
  assert.equal((await db.select().from(inventoryLogs)).length, 0);
}

// ---------------------------------------------------------------- Issue A (pure)

// ---------------------------------------------------------------- Issue A (DB)
test("recovery: active category recovers an expired order and captures stock once", async () => {
  const { db } = await open();
  await expiredOrder(db, "a1");
  const result = await pay(db, "a1", "k-a1");
  assert.equal(result.ok, true);
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 4);
  const [order] = await db.select().from(orders).where(eq(orders.id, "a1"));
  assert.equal(order?.paymentStatus, "verified");
  assert.equal((await db.select().from(inventoryLogs)).filter((row) => row.reason === "capture_recovered").length, 1);
});

test("recovery: disabled category is rejected with no partial mutation", async () => {
  const { db } = await open();
  await expiredOrder(db, "a2");
  await db.update(schema.productCategories).set({ isActive: false }).where(eq(schema.productCategories.id, "cat-a"));
  const result = await pay(db, "a2", "k-a2");
  assert.equal(result.ok, false);
  await assertNothingMutated(db, "a2");
});

test("recovery: deleted (missing) category is rejected with no partial mutation", async () => {
  const { db } = await open();
  await expiredOrder(db, "a3");
  await db.update(schema.productCategories).set({ deletedAt: new Date() }).where(eq(schema.productCategories.id, "cat-a"));
  const result = await pay(db, "a3", "k-a3");
  assert.equal(result.ok, false);
  await assertNothingMutated(db, "a3");
});

test("recovery: unpublished or deleted product is rejected", async () => {
  const { db } = await open();
  await expiredOrder(db, "a4");
  await db.update(schema.products).set({ status: "draft" }).where(eq(schema.products.id, "prod-a"));
  assert.equal((await pay(db, "a4", "k-a4")).ok, false);
  await assertNothingMutated(db, "a4");
  await db.update(schema.products).set({ status: "published", deletedAt: new Date() }).where(eq(schema.products.id, "prod-a"));
  assert.equal((await pay(db, "a4", "k-a4b")).ok, false);
  await assertNothingMutated(db, "a4");
});

test("recovery: inactive variant is rejected", async () => {
  const { db } = await open();
  await expiredOrder(db, "a5");
  await db.update(schema.productVariants).set({ status: "archived" }).where(eq(schema.productVariants.id, "var-a"));
  assert.equal((await pay(db, "a5", "k-a5")).ok, false);
  await assertNothingMutated(db, "a5");
});

test("recovery rejects a soft-deleted variant without mutating any line or payment state", async (t) => {
  const { db, pg } = await open();
  t.after(() => pg.close());
  await pg.exec(`
    insert into product_variants (id, product_id, sku, label, price_irr, status) values ('var-b', 'prod-a', 'SKU-A-2', 'بسته دیگر', 100000, 'active');
    insert into inventory (variant_id, on_hand, reserved, low_stock_threshold) values ('var-b', 5, 0, 1);
  `);
  await expiredOrder(db, "a-soft-delete");
  await db.insert(schema.orderItems).values({
    id: "oi-a-soft-delete-b", orderId: "a-soft-delete", variantId: "var-b", productName: "روغن", variantLabel: "بسته دیگر", sku: "SKU-A-2", quantity: 1, unitPriceIrr: 100000, lineTotalIrr: 100000,
  });
  await db.update(orders).set({ subtotalIrr: 200000, totalIrr: 200000 }).where(eq(orders.id, "a-soft-delete"));
  await db.update(schema.productVariants).set({ deletedAt: new Date() }).where(eq(schema.productVariants.id, "var-a"));
  assert.equal((await pay(db, "a-soft-delete", "k-a-soft-delete")).ok, false);
  await assertNothingMutated(db, "a-soft-delete");
  const stocks = await db.select().from(inventory);
  assert.equal(stocks.length, 2);
  for (const stock of stocks) {
    assert.equal(stock.onHand, 5);
    assert.equal(stock.reserved, 0);
  }
  assert.equal((await db.select().from(schema.paymentLogs)).length, 0);
  assert.equal((await db.select().from(schema.orderEvents)).length, 0);
  assert.equal((await db.select().from(schema.auditLogs)).length, 0);
  assert.equal((await db.select().from(schema.notifications)).length, 0);
});

test("payment against an existing hold still captures after variant soft-deletion", async (t) => {
  const { db, pg } = await open();
  t.after(() => pg.close());
  await expiredOrder(db, "a-held");
  await db.update(orders).set({ status: "awaiting_payment", stockState: "held" }).where(eq(orders.id, "a-held"));
  await db.update(inventory).set({ reserved: 1 }).where(eq(inventory.variantId, "var-a"));
  await db.update(schema.productVariants).set({ deletedAt: new Date() }).where(eq(schema.productVariants.id, "var-a"));
  assert.equal((await pay(db, "a-held", "k-a-held")).ok, true);
  const [order] = await db.select().from(orders).where(eq(orders.id, "a-held"));
  assert.equal(order?.status, "paid");
  assert.equal(order?.paymentStatus, "verified");
  assert.equal(order?.stockState, "captured");
  const [stock] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(stock?.onHand, 4);
  assert.equal(stock?.reserved, 0);
});

test("recovery: a second valid line does not get decremented when the first line fails", async () => {
  const { db, pg } = await open();
  await pg.exec(`
    insert into product_categories (id, slug, name, short_name, is_active) values ('cat-off', 'off', 'x', 'x', false);
    insert into products (id, category_id, slug, sku, name, status) values ('prod-b', 'cat-off', 'prod-b', 'SKU-B', 'b', 'published');
    insert into product_variants (id, product_id, sku, label, price_irr, status) values ('var-b', 'prod-b', 'SKU-B-1', 'b', 1000, 'active');
    insert into inventory (variant_id, on_hand, reserved, low_stock_threshold) values ('var-b', 5, 0, 1);
  `);
  await expiredOrder(db, "a6");
  await db.insert(schema.orderItems).values({
    id: "oi-a6b", orderId: "a6", variantId: "var-b", productName: "b", variantLabel: "b", sku: "SKU-B-1", quantity: 1, unitPriceIrr: 1000, lineTotalIrr: 1000,
  });
  assert.equal((await pay(db, "a6", "k-a6")).ok, false);
  for (const row of await db.select().from(inventory)) assert.equal(row.onHand, 5);
  assert.equal((await db.select().from(inventoryLogs)).length, 0);
  assert.equal((await db.select().from(payments)).length, 0);
});

test("already-paid order is unchanged by a later category deactivation and cannot be re-paid", async () => {
  const { db } = await open();
  await expiredOrder(db, "a7");
  assert.equal((await pay(db, "a7", "k-a7")).ok, true);
  await db.update(schema.productCategories).set({ isActive: false }).where(eq(schema.productCategories.id, "cat-a"));
  const replay = await pay(db, "a7", "k-a7");
  assert.equal(replay.ok && replay.already, true);
  const other = await pay(db, "a7", "k-a7-other");
  assert.equal(other.ok, false);
  const [order] = await db.select().from(orders).where(eq(orders.id, "a7"));
  assert.equal(order?.paymentStatus, "verified");
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 4);
});

// ---------------------------------------------------------------- Issue B

async function paidOrder(db: Db) {
  await db.insert(orders).values({
    id: "b1", publicCode: "SH-20261117-B1", status: "paid", paymentStatus: "verified", stockState: "captured", ...orderBase,
  });
  await db.insert(schema.orderItems).values({
    id: "oi-b1", orderId: "b1", variantId: "var-a", productName: "روغن", variantLabel: "۳۰ میلی", sku: "SKU-A-1", quantity: 1, unitPriceIrr: 100000, lineTotalIrr: 100000,
  });
  await db.update(inventory).set({ onHand: 4, reserved: 0 }).where(eq(inventory.variantId, "var-a"));
}
const payRow = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id, orderId: "b1", provider: "mock", status, amountIrr: 100000, currency: "IRR", idempotencyKey: `idem-${id}`, ...over,
});

test("paid cancel links the ledger refund to the verified payment among several attempts", async () => {
  const { db } = await open();
  await paidOrder(db);
  await db.insert(payments).values([payRow("pay-failed", "failed"), payRow("pay-pending", "pending"), payRow("pay-good", "verified")]);
  const result = await settlePaidCancel(db, "admin-1", "SH-20261117-B1", "تعیین تکلیف آزمون");
  assert.equal(result.ok, true);
  const refunds = (await db.select().from(payments)).filter((row) => row.provider === "ledger");
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0]?.refundOfPaymentId, "pay-good");
  assert.equal(refunds[0]?.orderId, "b1");
  assert.equal(refunds[0]?.amountIrr, 100000);
  assert.equal(refunds[0]?.currency, "IRR");
  assert.equal(refunds[0]?.status, "refund_recorded");
});

test("paid cancel with no verified payment fails safely and changes nothing", async () => {
  const { db } = await open();
  await paidOrder(db);
  await db.insert(payments).values([payRow("pay-failed", "failed"), payRow("pay-pending", "pending")]);
  const result = await settlePaidCancel(db, "admin-1", "SH-20261117-B1", "تعیین تکلیف آزمون");
  assert.equal(result.ok, false);
  const [order] = await db.select().from(orders).where(eq(orders.id, "b1"));
  assert.equal(order?.status, "paid");
  assert.equal(order?.paymentStatus, "verified");
  assert.equal(order?.stockState, "captured");
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 4);
  assert.equal((await db.select().from(payments)).filter((row) => row.provider === "ledger").length, 0);
  assert.equal((await db.select().from(schema.returnRequests)).length, 0);
  assert.equal((await db.select().from(auditLogs)).some((row) => row.action === "order.settled_cancel"), false);
});

test("a verified payment of another order is never used", async () => {
  const { db } = await open();
  await paidOrder(db);
  await db.insert(orders).values({ id: "b2", publicCode: "SH-20261117-B2", status: "paid", paymentStatus: "verified", stockState: "captured", ...orderBase });
  await db.insert(payments).values(payRow("pay-other", "verified", { orderId: "b2" }));
  assert.equal((await settlePaidCancel(db, "admin-1", "SH-20261117-B1", "تعیین تکلیف آزمون")).ok, false);
});

test("repeated paid cancel creates one refund and does not restock twice", async () => {
  const { db } = await open();
  await paidOrder(db);
  await db.insert(payments).values(payRow("pay-good", "verified"));
  assert.equal((await settlePaidCancel(db, "admin-1", "SH-20261117-B1", "تعیین تکلیف آزمون")).ok, true);
  const again = await settlePaidCancel(db, "admin-1", "SH-20261117-B1", "تعیین تکلیف آزمون");
  assert.equal(again.ok && again.already, true);
  assert.equal((await db.select().from(payments)).filter((row) => row.provider === "ledger").length, 1);
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 5);
});

// ---------------------------------------------------------------- Issue C
async function mediaFixture(db: Db, dir: string) {
  const disk = new LocalDiskStorage(dir);
  for (const n of ["unused", "shared", "other"]) await disk.put(`med-${n}01.jpg`, Uint8Array.from([1, 2, 3]));
  await db.insert(schema.mediaAssets).values(
    ["unused", "shared", "other"].map((n) => ({
      id: `med-${n}`, filename: `med-${n}01.jpg`, mimeType: "image/jpeg", storageKey: `local:med-${n}01.jpg`, publicUrl: `/media/file/med-${n}`,
    })),
  );
  return disk;
}
async function withStorage<T>(run: (dir: string) => Promise<T>) {
  const dir = mkdtempSync(join(tmpdir(), "shahoo-corr-"));
  const previous = process.env.STORAGE_LOCAL_DIR;
  process.env.STORAGE_LOCAL_DIR = dir;
  try {
    return await run(dir);
  } finally {
    if (previous === undefined) delete process.env.STORAGE_LOCAL_DIR;
    else process.env.STORAGE_LOCAL_DIR = previous;
  }
}

test("media: unused asset is retired and its file removed; referenced asset is refused", async () => {
  await withStorage(async (dir) => {
    const { db } = await open();
    const disk = await mediaFixture(db, dir);
    await db.insert(productImages).values({ id: "img-1", productId: "prod-a", mediaId: "med-shared", url: "/media/file/med-shared", isPrimary: true });
    assert.equal((await retireMedia(db, "admin-1", "med-shared")).ok, false);
    assert.ok(await disk.read("med-shared01.jpg"));
    assert.equal((await retireMedia(db, "admin-1", "med-unused")).ok, true);
    assert.equal(await disk.read("med-unused01.jpg"), null);
  });
});

test("media: attach, replace, banner and cover are refused once the asset is retired", async () => {
  await withStorage(async (dir) => {
    const { db } = await open();
    await mediaFixture(db, dir);
    assert.equal((await retireMedia(db, "admin-1", "med-unused")).ok, true);
    assert.equal((await attachMediaToProduct(db, "admin-1", "prod-a", "med-unused", true)).ok, false);
    await db.insert(productImages).values({ id: "img-1", productId: "prod-a", mediaId: "med-other", url: "/media/file/med-other", isPrimary: true });
    assert.equal((await replaceProductMediaLink(db, "admin-1", "img-1", "med-unused")).ok, false);
    assert.equal((await db.select().from(productImages).where(eq(productImages.mediaId, "med-unused"))).length, 0);
    await db.transaction(async (tx) => {
      assert.equal(await lockLiveMediaAsset(tx, "med-unused"), null);
      assert.ok(await lockLiveMediaAsset(tx, "med-other"));
    });
  });
});

test("media: replacing one image keeps a still-shared old asset, and detaching the last reference allows retire", async () => {
  await withStorage(async (dir) => {
    const { db } = await open();
    const disk = await mediaFixture(db, dir);
    await db.insert(productImages).values([
      { id: "img-1", productId: "prod-a", mediaId: "med-shared", url: "/media/file/med-shared", isPrimary: true },
      { id: "img-2", productId: "prod-a", mediaId: "med-shared", url: "/media/file/med-shared", isPrimary: false, sortOrder: 1 },
    ]);
    assert.equal((await replaceProductMediaLink(db, "admin-1", "img-1", "med-other")).ok, true);
    assert.equal((await retireMedia(db, "admin-1", "med-shared")).ok, false);
    assert.ok(await disk.read("med-shared01.jpg"));
    await db.delete(productImages).where(eq(productImages.id, "img-2"));
    assert.equal((await retireMedia(db, "admin-1", "med-shared")).ok, true);
    assert.equal(await disk.read("med-shared01.jpg"), null);
  });
});

test("media: a failed transaction leaves no reference and the asset stays live", async () => {
  await withStorage(async (dir) => {
    const { db } = await open();
    const disk = await mediaFixture(db, dir);
    await assert.rejects(
      db.transaction(async (tx) => {
        assert.ok(await lockLiveMediaAsset(tx, "med-unused"));
        await tx.insert(productImages).values({ id: "img-x", productId: "prod-a", mediaId: "med-unused", url: "/media/file/med-unused" });
        throw new Error("boom");
      }),
    );
    assert.equal((await db.select().from(productImages)).length, 0);
    const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, "med-unused"));
    assert.equal(asset?.deletedAt, null);
    assert.ok(await disk.read("med-unused01.jpg"));
  });
});

test("media: invariant after attach and retire are issued together (PGlite is single-connection, not race proof)", async () => {
  await withStorage(async (dir) => {
    const { db } = await open();
    await mediaFixture(db, dir);
    const [attached, retired] = await Promise.all([
      attachMediaToProduct(db, "admin-1", "prod-a", "med-unused", false),
      retireMedia(db, "admin-1", "med-unused"),
    ]);
    const [asset] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, "med-unused"));
    const refs = await db.select().from(productImages).where(eq(productImages.mediaId, "med-unused"));
    assert.equal(attached.ok && retired.ok, false, "both cannot succeed");
    if (refs.length > 0) assert.equal(asset?.deletedAt, null, "a referenced asset must stay live");
    else assert.ok(asset?.deletedAt, "an unreferenced winner of retire is soft-deleted");
  });
});

test("media: failed filesystem deletion is recorded and a retry removes the file once", async () => {
  await withStorage(async (dir) => {
    const { db } = await open();
    const disk = await mediaFixture(db, dir);
    const broken: ObjectStorage = { put: disk.put.bind(disk), read: disk.read.bind(disk), remove: async () => { throw new Error("EIO"); }, storageKey: disk.storageKey.bind(disk) };
    await db.update(schema.mediaAssets).set({ deletedAt: new Date() }).where(eq(schema.mediaAssets.id, "med-unused"));
    assert.equal(await removeFileOrRecord(db, "med-unused", "med-unused01.jpg", broken), false);
    assert.equal((await db.select().from(opsDiagnostics).where(eq(opsDiagnostics.kind, "media.file_cleanup"))).length, 1);
    assert.ok(await disk.read("med-unused01.jpg"));
    assert.deepEqual(await retryPendingMediaCleanup(db, broken), { removed: 0, skipped: 0, failed: 1 });
    assert.deepEqual(await retryPendingMediaCleanup(db, disk), { removed: 1, skipped: 0, failed: 0 });
    assert.equal(await disk.read("med-unused01.jpg"), null);
    assert.deepEqual(await retryPendingMediaCleanup(db, disk), { removed: 0, skipped: 0, failed: 0 });
  });
});

test("media: retry never removes a file whose asset is live or referenced", async () => {
  await withStorage(async (dir) => {
    const { db } = await open();
    const disk = await mediaFixture(db, dir);
    const broken: ObjectStorage = { put: disk.put.bind(disk), read: disk.read.bind(disk), remove: async () => { throw new Error("EIO"); }, storageKey: disk.storageKey.bind(disk) };
    await removeFileOrRecord(db, "med-other", "med-other01.jpg", broken); // asset still live
    assert.deepEqual(await retryPendingMediaCleanup(db, disk), { removed: 0, skipped: 1, failed: 0 });
    assert.ok(await disk.read("med-other01.jpg"));
  });
});
