import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { retireMedia } from "../cms/content.ts";
import { auditLogs, cartItems, carts, inventory, inventoryLogs, orders, payments, productImages } from "../db/schema.ts";
import * as schema from "../db/schema.ts";
import { LocalDiskStorage } from "../media/disk.ts";
import { replaceProductMediaLink } from "../media/storage.ts";
import { captureVerifiedPayment, type PaymentProvider } from "../payments/service.ts";
import { adoptLinesIntoCart, mergeCartInto, mutateCartLine } from "./cart.ts";
import { commitCheckout } from "./checkout.ts";
import { moveOrderStatus, recordRefund } from "./fulfillment.ts";
import { releaseExpiredHolds } from "./holds.ts";

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

const addressInput = {
  fullName: "آزاده رضایی",
  mobile: "09120000001",
  province: "تهران",
  city: "تهران",
  addressLine: "خیابان آزمایشی بلندتر",
  postalCode: "1234567890",
  plaque: "4",
  unit: "1",
  customerNote: "",
  shippingMethodId: "ship-post",
  couponCode: "",
  idempotencyKey: "key-batch02",
  addressId: null as string | null,
};

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
    insert into shipping_methods (id, key, title, price_irr, is_active) values ('ship-post', 'post', 'پست', 0, true);
    insert into customers (id, mobile, full_name, status) values ('cust-a', '09120000001', 'آزاده رضایی', 'active');
    insert into admin_users (id, email, full_name, status) values ('admin-1', 'desk@example.com', 'مدیر', 'active');
    insert into carts (id, customer_id) values ('cart-1', 'cust-a');
    insert into carts (id, guest_token_hash) values ('cart-guest', 'guest-hash');
    insert into cart_items (id, cart_id, variant_id, quantity) values ('ci-1', 'cart-1', 'var-a', 2), ('ci-g', 'cart-guest', 'var-a', 2);
  `);
  return { pg, db };
}

const cart = { id: "cart-1", customerId: "cust-a", buyerKey: "c:cust-a" };
const customer = { id: "cust-a", fullName: "آزاده رضایی", mobile: "09120000001" };

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

test("guest cart merge sums once and a second merge does not duplicate quantity", async () => {
  const { db } = await open();
  const first = await mergeCartInto(db, "cart-1", "cart-guest");
  assert.equal(first.merged, true);
  const lines = await db.select().from(cartItems).where(eq(cartItems.cartId, "cart-1"));
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.quantity, 4);
  const second = await mergeCartInto(db, "cart-1", "cart-guest");
  assert.equal(second.merged, false);
  const [again] = await db.select().from(cartItems).where(eq(cartItems.cartId, "cart-1"));
  assert.equal(again?.quantity, 4);
  assert.equal((await db.select().from(carts).where(eq(carts.id, "cart-guest"))).length, 0);
});

test("repeated local adopt uses the larger quantity and does not add it twice", async () => {
  const { db } = await open();
  await adoptLinesIntoCart(db, "cart-1", [{ variantId: "var-a", quantity: 2 }]);
  await adoptLinesIntoCart(db, "cart-1", [{ variantId: "var-a", quantity: 2 }]);
  const [same] = await db.select().from(cartItems).where(eq(cartItems.cartId, "cart-1"));
  assert.equal(same?.quantity, 2);
  await adoptLinesIntoCart(db, "cart-1", [{ variantId: "var-a", quantity: 4 }]);
  const [raised] = await db.select().from(cartItems).where(eq(cartItems.cartId, "cart-1"));
  assert.equal(raised?.quantity, 4);
  await adoptLinesIntoCart(db, "cart-1", [{ variantId: "var-a", quantity: 3 }]);
  const [kept] = await db.select().from(cartItems).where(eq(cartItems.cartId, "cart-1"));
  assert.equal(kept?.quantity, 4);
});

test("concurrent cart adds keep one line and both increments", async () => {
  const { db } = await open();
  const [first, second] = await Promise.all([
    mutateCartLine(db, "cart-1", "var-a", "add", 1, 5, true),
    mutateCartLine(db, "cart-1", "var-a", "add", 1, 5, true),
  ]);
  assert.equal(first.ok && second.ok, true);
  const lines = await db.select().from(cartItems).where(eq(cartItems.cartId, "cart-1"));
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.quantity, 4);
});

test("checkout uses the live server price and rolls back when the product is no longer for sale", async () => {
  const { db } = await open();
  await db.update(schema.productVariants).set({ priceIrr: 250000 }).where(eq(schema.productVariants.id, "var-a"));
  const placed = await commitCheckout(db, addressInput, cart, customer);
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  const [order] = await db.select().from(orders);
  assert.equal(order?.subtotalIrr, 500000);
  const fresh = await open();
  await fresh.db.update(schema.products).set({ status: "draft" }).where(eq(schema.products.id, "prod-a"));
  const blocked = await commitCheckout(fresh.db, addressInput, cart, customer);
  assert.equal(blocked.ok, false);
  assert.equal((await fresh.db.select().from(orders)).length, 0);
  assert.equal((await fresh.db.select().from(cartItems)).length, 2);
  const [stock] = await fresh.db.select().from(inventory);
  assert.equal(stock?.reserved, 0);
});

test("the same checkout key replays and a different buyer or a broken key does not create an order", async () => {
  const { db } = await open();
  const placed = await commitCheckout(db, addressInput, cart, customer);
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  const replay = await commitCheckout(db, addressInput, { ...cart, id: "missing" }, customer);
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.publicCode, placed.publicCode);
  const otherBuyer = await commitCheckout(db, addressInput, { id: "cart-x", customerId: "cust-b", buyerKey: "c:cust-b" }, customer);
  assert.equal(otherBuyer.ok, false);
  const badKey = await commitCheckout(db, { ...addressInput, idempotencyKey: "bad key" }, cart, null);
  assert.equal(badKey.ok, false);
  assert.equal((await db.select().from(orders)).length, 1);
});

test("a failed payment stays unpaid and cannot later flip to verified with the same key", async () => {
  const { db } = await open();
  await db.insert(orders).values({
    id: "ord-pay",
    publicCode: "SH-20261117-PAY1",
    customerId: "cust-a",
    status: "awaiting_payment",
    paymentStatus: "unpaid",
    stockState: "held",
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلندتر",
    subtotalIrr: 200000,
    totalIrr: 200000,
  });
  await db.insert(schema.orderItems).values({
    id: "oi-pay",
    orderId: "ord-pay",
    variantId: "var-a",
    productName: "روغن",
    variantLabel: "۳۰ میلی",
    sku: "SKU-A-1",
    quantity: 1,
    unitPriceIrr: 200000,
    lineTotalIrr: 200000,
  });
  await db.update(inventory).set({ reserved: 1 }).where(eq(inventory.variantId, "var-a"));
  const failed = await captureVerifiedPayment(db, {
    orderId: "ord-pay",
    idempotencyKey: "pay-fail",
    token: "nope",
    provider,
    currency: "IRR",
    amountIrr: 200000,
  });
  assert.equal(failed.ok, false);
  const [order] = await db.select().from(orders).where(eq(orders.id, "ord-pay"));
  assert.equal(order?.paymentStatus, "unpaid");
  assert.equal(order?.status, "awaiting_payment");
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 5);
  assert.equal(stock?.reserved, 1);
  const flipped = await captureVerifiedPayment(db, {
    orderId: "ord-pay",
    idempotencyKey: "pay-fail",
    token: "mock-ok:mock-pay-fail",
    provider,
  });
  assert.equal(flipped.ok, false);
  const paid = await captureVerifiedPayment(db, {
    orderId: "ord-pay",
    idempotencyKey: "pay-ok",
    token: "mock-ok:mock-pay-ok",
    provider,
  });
  assert.equal(paid.ok, true);
  const again = await captureVerifiedPayment(db, {
    orderId: "ord-pay",
    idempotencyKey: "pay-other",
    token: "mock-ok:mock-pay-other",
    provider,
  });
  assert.equal(again.ok, false);
  const [after] = await db.select().from(inventory);
  assert.equal(after?.onHand, 4);
  assert.equal(after?.reserved, 0);
  const audits = await db.select().from(auditLogs);
  assert.equal(audits.some((row) => row.action === "payment.verified"), true);
  assert.equal(audits.some((row) => row.action === "payment.failed"), true);
});

test("currency and amount mismatches are rejected before a payment is stored", async () => {
  const { db } = await open();
  await db.insert(orders).values({
    id: "ord-pay",
    publicCode: "SH-20261117-PAY2",
    status: "awaiting_payment",
    paymentStatus: "unpaid",
    stockState: "held",
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلندتر",
    subtotalIrr: 1000,
    totalIrr: 1000,
  });
  const currency = await captureVerifiedPayment(db, {
    orderId: "ord-pay",
    idempotencyKey: "pay-usd",
    token: "mock-ok:mock-pay-usd",
    provider,
    currency: "USD",
  });
  assert.equal(currency.ok, false);
  const amount = await captureVerifiedPayment(db, {
    orderId: "ord-pay",
    idempotencyKey: "pay-amt",
    token: "mock-ok:mock-pay-amt",
    provider,
    amountIrr: 50,
  });
  assert.equal(amount.ok, false);
  assert.equal((await db.select().from(payments)).length, 0);
  const [order] = await db.select().from(orders).where(eq(orders.id, "ord-pay"));
  assert.equal(order?.paymentStatus, "unpaid");
});

test("expiry releases a hold once, skips a paid order, and payment can recover stock", async () => {
  const { db } = await open();
  const past = new Date(Date.now() - 60_000);
  await db.insert(orders).values({
    id: "ord-hold",
    publicCode: "SH-20261117-HOLD",
    status: "awaiting_payment",
    paymentStatus: "unpaid",
    stockState: "held",
    stockHoldUntil: past,
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلندتر",
    subtotalIrr: 100000,
    totalIrr: 100000,
  });
  await db.insert(schema.orderItems).values({
    id: "oi-hold",
    orderId: "ord-hold",
    variantId: "var-a",
    productName: "روغن",
    variantLabel: "۳۰ میلی",
    sku: "SKU-A-1",
    quantity: 1,
    unitPriceIrr: 100000,
    lineTotalIrr: 100000,
  });
  await db.update(inventory).set({ reserved: 1 }).where(eq(inventory.variantId, "var-a"));
  await releaseExpiredHolds(db);
  await releaseExpiredHolds(db);
  const [released] = await db.select().from(inventory);
  assert.equal(released?.reserved, 0);
  assert.equal(released?.onHand, 5);
  const logs = await db.select().from(inventoryLogs);
  assert.equal(logs.filter((row) => row.reason === "release_expired").length, 1);
  const [expired] = await db.select().from(orders).where(eq(orders.id, "ord-hold"));
  assert.equal(expired?.status, "expired");
  const recovered = await captureVerifiedPayment(db, {
    orderId: "ord-hold",
    idempotencyKey: "pay-recover",
    token: "mock-ok:mock-pay-recover",
    provider,
  });
  assert.equal(recovered.ok, true);
  const [sold] = await db.select().from(inventory);
  assert.equal(sold?.onHand, 4);
  assert.equal(sold?.reserved, 0);
  const repeat = await captureVerifiedPayment(db, {
    orderId: "ord-hold",
    idempotencyKey: "pay-recover",
    token: "mock-ok:mock-pay-recover",
    provider,
  });
  assert.equal(repeat.ok && repeat.already, true);
  const [still] = await db.select().from(inventory);
  assert.equal(still?.onHand, 4);

  const paid = await open();
  await paid.db.insert(orders).values({
    id: "ord-paid",
    publicCode: "SH-20261117-PAID",
    status: "paid",
    paymentStatus: "verified",
    stockState: "captured",
    stockHoldUntil: past,
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلندتر",
    subtotalIrr: 100000,
    totalIrr: 100000,
  });
  await paid.db.update(inventory).set({ onHand: 4, reserved: 0 }).where(eq(inventory.variantId, "var-a"));
  await releaseExpiredHolds(paid.db);
  const [untouched] = await paid.db.select().from(inventory);
  assert.equal(untouched?.onHand, 4);
  assert.equal(untouched?.reserved, 0);
});

test("payment after an expired hold does not mark the order paid when stock is gone", async () => {
  const { db } = await open();
  await db.insert(orders).values({
    id: "ord-dry",
    publicCode: "SH-20261117-DRY",
    status: "expired",
    paymentStatus: "unpaid",
    stockState: "released",
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلندتر",
    subtotalIrr: 100000,
    totalIrr: 100000,
  });
  await db.insert(schema.orderItems).values({
    id: "oi-dry",
    orderId: "ord-dry",
    variantId: "var-a",
    productName: "روغن",
    variantLabel: "۳۰ میلی",
    sku: "SKU-A-1",
    quantity: 1,
    unitPriceIrr: 100000,
    lineTotalIrr: 100000,
  });
  await db.update(inventory).set({ onHand: 0, reserved: 0 }).where(eq(inventory.variantId, "var-a"));
  const blocked = await captureVerifiedPayment(db, {
    orderId: "ord-dry",
    idempotencyKey: "pay-dry",
    token: "mock-ok:mock-pay-dry",
    provider,
  });
  assert.equal(blocked.ok, false);
  const [order] = await db.select().from(orders).where(eq(orders.id, "ord-dry"));
  assert.equal(order?.status, "expired");
  assert.equal(order?.paymentStatus, "unpaid");
  assert.equal((await db.select().from(payments)).length, 0);
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 0);
});

test("late payment recovery rejects every unsellable line and rolls back all effects", async () => {
  const cases = [
    ["unpublished product", async (db: Awaited<ReturnType<typeof open>>["db"]) => db.update(schema.products).set({ status: "draft" }).where(eq(schema.products.id, "prod-a"))],
    ["soft-deleted product", async (db: Awaited<ReturnType<typeof open>>["db"]) => db.update(schema.products).set({ deletedAt: new Date() }).where(eq(schema.products.id, "prod-a"))],
    ["inactive variant", async (db: Awaited<ReturnType<typeof open>>["db"]) => db.update(schema.productVariants).set({ status: "inactive" }).where(eq(schema.productVariants.id, "var-a"))],
    ["soft-deleted variant", async (db: Awaited<ReturnType<typeof open>>["db"]) => db.update(schema.productVariants).set({ deletedAt: new Date() }).where(eq(schema.productVariants.id, "var-a"))],
    ["inactive category", async (db: Awaited<ReturnType<typeof open>>["db"]) => db.update(schema.productCategories).set({ isActive: false }).where(eq(schema.productCategories.id, "cat-a"))],
    ["soft-deleted category", async (db: Awaited<ReturnType<typeof open>>["db"]) => db.update(schema.productCategories).set({ deletedAt: new Date() }).where(eq(schema.productCategories.id, "cat-a"))],
    ["insufficient available stock", async (db: Awaited<ReturnType<typeof open>>["db"]) => db.update(inventory).set({ onHand: 0, reserved: 0 }).where(eq(inventory.variantId, "var-a"))],
  ] as const;

  for (const [label, invalidate] of cases) {
    const { db } = await open();
    await db.insert(orders).values({
      id: "ord-recovery-matrix", publicCode: "SH-20261120-MATRIX",
      status: "expired", paymentStatus: "unpaid", stockState: "released",
      fullName: "آزاده", mobile: "09120000001", province: "تهران", city: "تهران",
      addressLine: "خیابان آزمایشی بلندتر", subtotalIrr: 100000, totalIrr: 100000,
    });
    await db.insert(schema.orderItems).values({
      id: "oi-recovery-matrix", orderId: "ord-recovery-matrix", variantId: "var-a",
      productName: "روغن", variantLabel: "۳۰ میلی", sku: "SKU-A-1",
      quantity: 1, unitPriceIrr: 100000, lineTotalIrr: 100000,
    });
    await invalidate(db);
    const beforeStock = (await db.select().from(inventory))[0];
    const result = await captureVerifiedPayment(db, {
      orderId: "ord-recovery-matrix", idempotencyKey: "pay-recovery-matrix-" + label.replaceAll(" ", "-"),
      token: "mock-ok:mock-pay-recovery-matrix-" + label.replaceAll(" ", "-"), provider,
    });
    assert.equal(result.ok, false, label + ": payment must not be captured");
    const [order] = await db.select().from(orders).where(eq(orders.id, "ord-recovery-matrix"));
    const afterStock = (await db.select().from(inventory))[0];
    assert.equal(order?.status, "expired", label + ": order status");
    assert.equal(order?.paymentStatus, "unpaid", label + ": payment status");
    assert.equal(order?.stockState, "released", label + ": stock state");
    assert.deepEqual(afterStock && { onHand: afterStock.onHand, reserved: afterStock.reserved },
      beforeStock && { onHand: beforeStock.onHand, reserved: beforeStock.reserved }, label + ": inventory rollback");
    assert.equal((await db.select().from(payments)).length, 0, label + ": no payment row");
    assert.equal((await db.select().from(inventoryLogs)).length, 0, label + ": no inventory log");
    assert.equal((await db.select().from(auditLogs)).length, 0, label + ": no audit side effect");
  }
});

test("expiry and payment leave one consistent stock result", async () => {
  const { db } = await open();
  const past = new Date(Date.now() - 60_000);
  await db.insert(orders).values({
    id: "ord-race",
    publicCode: "SH-20261117-RACE",
    status: "awaiting_payment",
    paymentStatus: "unpaid",
    stockState: "held",
    stockHoldUntil: past,
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلندتر",
    subtotalIrr: 100000,
    totalIrr: 100000,
  });
  await db.insert(schema.orderItems).values({
    id: "oi-race",
    orderId: "ord-race",
    variantId: "var-a",
    productName: "روغن",
    variantLabel: "۳۰ میلی",
    sku: "SKU-A-1",
    quantity: 1,
    unitPriceIrr: 100000,
    lineTotalIrr: 100000,
  });
  await db.update(inventory).set({ onHand: 5, reserved: 1 }).where(eq(inventory.variantId, "var-a"));
  await Promise.all([
    releaseExpiredHolds(db),
    captureVerifiedPayment(db, {
      orderId: "ord-race",
      idempotencyKey: "pay-race",
      token: "mock-ok:mock-pay-race",
      provider,
    }),
  ]);
  const [order] = await db.select().from(orders).where(eq(orders.id, "ord-race"));
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.reserved, 0);
  if (order?.status === "paid") {
    assert.equal(order.paymentStatus, "verified");
    assert.equal(order.stockState, "captured");
    assert.equal(stock?.onHand, 4);
  } else {
    assert.equal(order?.status, "expired");
    assert.equal(order?.paymentStatus, "unpaid");
    assert.equal(order?.stockState, "released");
    assert.equal(stock?.onHand, 5);
  }
  const paidLogs = (await db.select().from(inventoryLogs)).filter((row) => row.reason === "capture_paid" || row.reason === "capture_recovered");
  assert.equal(paidLogs.length <= 1, true);
});

test("partial refunds stay within the verified payment and do not restock unless asked", async () => {
  const { db } = await open();
  await db.update(inventory).set({ onHand: 4, reserved: 0 }).where(eq(inventory.variantId, "var-a"));
  await db.insert(orders).values({
    id: "ord-ref",
    publicCode: "SH-20261117-REF",
    customerId: "cust-a",
    status: "delivered",
    paymentStatus: "verified",
    stockState: "captured",
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلندتر",
    subtotalIrr: 1000,
    totalIrr: 1000,
  });
  await db.insert(schema.orderItems).values({
    id: "oi-ref",
    orderId: "ord-ref",
    variantId: "var-a",
    productName: "روغن",
    variantLabel: "۳۰ میلی",
    sku: "SKU-A-1",
    quantity: 1,
    unitPriceIrr: 1000,
    lineTotalIrr: 1000,
  });
  await db.insert(payments).values({
    id: "pay-verified",
    orderId: "ord-ref",
    provider: "mock",
    status: "verified",
    amountIrr: 600,
    currency: "IRR",
    idempotencyKey: "verified-ref",
  });
  await db.insert(schema.returnRequests).values([
    { id: "ret-1", orderId: "ord-ref", customerId: "cust-a", reason: "بخشی از کالا کمبود داشت.", status: "approved", amountIrr: 0 },
    { id: "ret-2", orderId: "ord-ref", customerId: "cust-a", reason: "بسته آسیب دیده بود.", status: "approved", amountIrr: 0 },
  ]);
  const tooMuch = await recordRefund(db, "admin-1", "ret-1", "partial", 700, "دلیل آزمون");
  assert.equal(tooMuch.ok, false);
  const wrongPayment = await recordRefund(db, "admin-1", "ret-1", "partial", 200, "دلیل آزمون", { paymentId: "pay-other" });
  assert.equal(wrongPayment.ok, false);
  const first = await recordRefund(db, "admin-1", "ret-1", "partial", 200, "دلیل آزمون", { restock: true });
  assert.equal(first.ok, false);
  const partial = await recordRefund(db, "admin-1", "ret-1", "partial", 200, "دلیل آزمون");
  assert.equal(partial.ok, true);
  const [held] = await db.select().from(inventory);
  assert.equal(held?.onHand, 4);
  const duplicate = await recordRefund(db, "admin-1", "ret-1", "partial", 200, "دلیل آزمون");
  assert.equal(duplicate.ok, true);
  if (duplicate.ok && "already" in duplicate) assert.equal(duplicate.already, true);
  const rest = await recordRefund(db, "admin-1", "ret-2", "full", 0, "دلیل آزمون", { restock: true });
  assert.equal(rest.ok, true);
  const rows = await db.select().from(schema.returnRequests);
  const sum = rows.reduce((total, row) => total + Number(row.amountIrr), 0);
  assert.equal(sum, 600);
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 5);
  const [order] = await db.select().from(orders).where(eq(orders.id, "ord-ref"));
  assert.equal(order?.status, "refunded");
  assert.equal(order?.stockState, "restocked");
  const ledger = await db.select().from(payments);
  assert.equal(ledger.some((row) => row.refundOfPaymentId === "pay-verified"), true);
});

test("an explicit full restock runs once and an illegal order move writes no audit", async () => {
  const { db } = await open();
  await db.update(inventory).set({ onHand: 4, reserved: 0 }).where(eq(inventory.variantId, "var-a"));
  await db.insert(orders).values({
    id: "ord-stock",
    publicCode: "SH-20261117-STK",
    customerId: "cust-a",
    status: "delivered",
    paymentStatus: "verified",
    stockState: "captured",
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلندتر",
    subtotalIrr: 1000,
    totalIrr: 1000,
  });
  await db.insert(schema.orderItems).values({
    id: "oi-stock",
    orderId: "ord-stock",
    variantId: "var-a",
    productName: "روغن",
    variantLabel: "۳۰ میلی",
    sku: "SKU-A-1",
    quantity: 1,
    unitPriceIrr: 1000,
    lineTotalIrr: 1000,
  });
  await db.insert(schema.returnRequests).values({
    id: "ret-full",
    orderId: "ord-stock",
    customerId: "cust-a",
    reason: "کل سفارش برمی‌گردد.",
    status: "approved",
    amountIrr: 0,
  });
  const refunded = await recordRefund(db, "admin-1", "ret-full", "full", 0, "دلیل آزمون", { restock: true });
  assert.equal(refunded.ok, true);
  const [stock] = await db.select().from(inventory);
  assert.equal(stock?.onHand, 5);
  const again = await recordRefund(db, "admin-1", "ret-full", "full", 0, "دلیل آزمون", { restock: true });
  assert.equal(again.ok, true);
  const [still] = await db.select().from(inventory);
  assert.equal(still?.onHand, 5);
  const illegal = await moveOrderStatus(db, "admin-1", "SH-20261117-STK", "paid", "دلیل آزمون");
  assert.equal(illegal.ok, false);
  const audits = await db.select().from(auditLogs);
  assert.equal(audits.some((row) => row.action === "order.status"), false);
});

test("shared media is not deleted and a replacement leaves the shared file in place", async () => {
  const dir = mkdtempSync(join(tmpdir(), "shahoo-b02-"));
  const previous = process.env.STORAGE_LOCAL_DIR;
  process.env.STORAGE_LOCAL_DIR = dir;
  try {
    const disk = new LocalDiskStorage(dir);
    await disk.put("med-shared01.jpg", Uint8Array.from([1, 2, 3]));
    await disk.put("med-second01.jpg", Uint8Array.from([4, 5, 6]));
    const { db } = await open();
    await db.insert(schema.mediaAssets).values([
      {
        id: "med-shared",
        filename: "med-shared01.jpg",
        mimeType: "image/jpeg",
        storageKey: "local:med-shared01.jpg",
        publicUrl: "/media/file/med-shared",
      },
      {
        id: "med-second",
        filename: "med-second01.jpg",
        mimeType: "image/jpeg",
        storageKey: "local:med-second01.jpg",
        publicUrl: "/media/file/med-second",
      },
    ]);
    await db.insert(productImages).values([
      { id: "img-1", productId: "prod-a", mediaId: "med-shared", url: "/media/file/med-shared", alt: "اول", isPrimary: true, sortOrder: 0 },
      { id: "img-2", productId: "prod-a", mediaId: "med-shared", url: "/media/file/med-shared", alt: "دوم", isPrimary: false, sortOrder: 1 },
    ]);
    const blocked = await retireMedia(db, "admin-1", "med-shared");
    assert.equal(blocked.ok, false);
    assert.ok(await disk.read("med-shared01.jpg"));
    const replaced = await replaceProductMediaLink(db, "admin-1", "img-1", "med-second");
    assert.equal(replaced.ok, true);
    assert.ok(await disk.read("med-shared01.jpg"));
    await db.delete(productImages).where(eq(productImages.id, "img-2"));
    await db.delete(productImages).where(eq(productImages.id, "img-1"));
    const retired = await retireMedia(db, "admin-1", "med-shared");
    assert.equal(retired.ok, true);
    assert.equal(await disk.read("med-shared01.jpg"), null);
    assert.ok(await disk.read("med-second01.jpg"));
  } finally {
    if (previous === undefined) delete process.env.STORAGE_LOCAL_DIR;
    else process.env.STORAGE_LOCAL_DIR = previous;
  }
});
