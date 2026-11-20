import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { commitCheckout, consumeCartLines, resolveCheckoutAddress } from "./checkout.ts";
import { reserveGuestCheckout } from "./guest-checkout-limit.ts";
import { isIdempotencyConflict } from "../db/sql-error.ts";
import { cartItems, inventory, orders } from "../db/schema.ts";
import * as schema from "../db/schema.ts";

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
  idempotencyKey: "key-1",
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
    insert into customer_addresses (id, customer_id, label, province, city, address_line, postal_code, plaque, unit, is_default)
      values ('addr-1', 'cust-a', 'خانه', 'سیستان و بلوچستان', 'زاهدان', 'خیابان دانشگاه طولانی', '9812345678', '12', '2', true);
    insert into carts (id, customer_id) values ('cart-1', 'cust-a');
    insert into cart_items (id, cart_id, variant_id, quantity) values ('ci-1', 'cart-1', 'var-a', 2);
  `);
  return { pg, db };
}

const cart = { id: "cart-1", customerId: "cust-a", buyerKey: "c:cust-a" };
const customer = { id: "cust-a", fullName: "آزاده رضایی", mobile: "09120000001" };

for (const withExpectation of [false, true]) {
  test(`checkout rejects an already-carted soft-deleted variant (${withExpectation ? "reviewed cart" : "legacy cart"})`, async (t) => {
    const { pg, db } = await open();
    t.after(() => pg.close());
    await db.update(schema.productVariants).set({ deletedAt: new Date() }).where(eq(schema.productVariants.id, "var-a"));
    const input = withExpectation
      ? { ...addressInput, cartExpectation: { cartId: cart.id, ownerMobile: customer.mobile, lines: [{ variantId: "var-a", quantity: 2, unitPriceIrr: 100000 }] } }
      : addressInput;
    const result = await commitCheckout(db, input, cart, customer);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /دیگر قابل فروش نیست/);
    assert.equal((await db.select().from(orders)).length, 0);
    assert.equal((await db.select().from(schema.orderItems)).length, 0);
    assert.equal((await db.select().from(schema.orderEvents)).length, 0);
    assert.equal((await db.select().from(schema.inventoryLogs)).length, 0);
    assert.equal((await db.select().from(schema.auditLogs)).length, 0);
    assert.equal((await db.select().from(schema.notifications)).length, 0);
    const [stock] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
    assert.equal(stock?.onHand, 5);
    assert.equal(stock?.reserved, 0);
    const lines = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.quantity, 2);
  });
}

test("saved address fields win over edited form text and are what the order stores", async () => {
  const saved = {
    recipientName: "آزاده رضایی",
    recipientMobile: "09120000001",
    province: "سیستان و بلوچستان",
    city: "زاهدان",
    addressLine: "خیابان دانشگاه طولانی",
    postalCode: "9812345678",
    plaque: "12",
    unit: "2",
  };
  const resolved = resolveCheckoutAddress(
    { ...addressInput, city: "تهران", province: "تهران", addressLine: "نشانی ویرایش‌شده که نباید ذخیره شود", addressId: "addr-1" },
    customer,
    saved,
  );
  assert.equal("error" in resolved, false);
  if ("error" in resolved) return;
  assert.equal(resolved.city, "زاهدان");
  assert.equal(resolved.province, "سیستان و بلوچستان");
  assert.equal(resolved.addressLine, "خیابان دانشگاه طولانی");

  const fresh = resolveCheckoutAddress({ ...addressInput, city: "چابهار", addressId: null }, customer, null);
  assert.equal("error" in fresh, false);
  if (!("error" in fresh)) assert.equal(fresh.city, "چابهار");

  const { db } = await open();
  const placed = await commitCheckout(
    db,
    { ...addressInput, city: "تهران", province: "تهران", addressLine: "نشانی ویرایش‌شده که نباید ذخیره شود", addressId: "addr-1" },
    cart,
    customer,
  );
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  const [order] = await db.select().from(orders).where(eq(orders.publicCode, placed.publicCode));
  assert.equal(order?.city, "زاهدان");
  assert.equal(order?.province, "سیستان و بلوچستان");
  assert.equal(order?.addressLine, "خیابان دانشگاه طولانی");
  assert.equal(order?.addressId, "addr-1");
});

test("one cart cannot create two orders from different idempotency keys", async () => {
  const { db } = await open();
  const [first, second] = await Promise.all([
    commitCheckout(db, { ...addressInput, idempotencyKey: "key-a" }, cart, customer),
    commitCheckout(db, { ...addressInput, idempotencyKey: "key-b" }, cart, customer),
  ]);
  const successes = [first, second].filter((result) => result.ok);
  assert.equal(successes.length, 1);
  const stored = await db.select().from(orders);
  assert.equal(stored.length, 1);
  const [stock] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(stock?.reserved, 2);
  const lines = await db.select().from(cartItems).where(eq(cartItems.cartId, "cart-1"));
  assert.equal(lines.length, 0);
});

test("a cart line changed after the snapshot is not deleted", async () => {
  const { db } = await open();
  await assert.rejects(
    () =>
      db.transaction(async (tx) => {
        await consumeCartLines(tx, "cart-1", [{ variantId: "var-a", quantity: 1 }]);
      }),
    /سبد هنگام ثبت تغییر کرد/,
  );
  const lines = await db.select().from(cartItems);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.quantity, 2);
});

test("idempotency conflicts are recognized by SQLSTATE and constraint name", async () => {
  const { pg, db } = await open();
  const placed = await commitCheckout(db, addressInput, cart, customer);
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  const [order] = await db.select().from(orders).where(eq(orders.publicCode, placed.publicCode));
  let caught: unknown;
  try {
    await pg.query(
      `insert into orders (id, public_code, full_name, mobile, province, city, address_line, subtotal_irr, total_irr, idempotency_key)
       values ('ord-dup', 'SH-20990101-DUPL', 'آزاده', '09120000001', 'تهران', 'تهران', 'خیابان آزمایشی بلندتر', 1, 1, $1)`,
      [order?.idempotencyKey],
    );
  } catch (error) {
    caught = error;
  }
  assert.equal(isIdempotencyConflict(caught), true);
  const replay = await commitCheckout(db, addressInput, { ...cart, id: "cart-missing" }, customer);
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.publicCode, placed.publicCode);
  const stored = await db.select().from(orders);
  assert.equal(stored.length, 1);
});


test("guest checkout is durably rate-limited by both IP and guest cart", async (t) => {
  const { pg, db } = await open();
  t.after(() => pg.close());
  for (let i = 0; i < 3; i += 1) {
    const result = await reserveGuestCheckout(db, { ip: "203.0.113.8", cartKey: "guest-cart-throttle", now: 1_800_000_000_000 + i });
    assert.equal(result.ok, true);
  }
  const blocked = await reserveGuestCheckout(db, { ip: "203.0.113.8", cartKey: "guest-cart-throttle", now: 1_800_000_000_010 });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.retryAfterSec > 0);
});
