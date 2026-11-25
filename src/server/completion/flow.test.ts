import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { listAddresses, saveAddress } from "../account/addresses.ts";
import { mergeSaved, toggleSaved } from "../account/wishlist.ts";
import { reserveOtpSend } from "../auth/otp-limit.ts";
import { throttleSubject } from "../auth/throttle.ts";
import { submitReview } from "../catalog/reviews.ts";
import { moveOrderStatus, recordRefund, recordShipment, requestReturn, reviewReturn, settlePaidCancel } from "../commerce/fulfillment.ts";
import { detachProductImage, LocalDiskStorage, attachMediaToProduct, localObjectName, storeUploadedImage } from "../media/storage.ts";
import { handleMediaUpload, readBoundedBody } from "../media/upload-request.ts";
import { sanitizeImage } from "../media/sanitize-image.ts";
import { SessionError } from "../auth/guard.ts";
import { retireMedia } from "../cms/content.ts";
import { captureVerifiedPayment, resolvePaymentProvider, samePaymentReplay, type PaymentProvider } from "../payments/service.ts";
import { openTicket, replyTicket, customerTickets, ticketThread } from "../support/tickets.ts";
import { auditLogs, inventory, mediaAssets, orderEvents, orders, payments, productImages, returnEvents, returnRequests } from "../db/schema.ts";
import * as schema from "../db/schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function database() {
  const pg = new PGlite();
  for (const name of ["0002_shahoo_foundation.sql", "0003_commerce_cart.sql", "0004_batch_0501.sql", "0005_batch_0502.sql", "0006_completion.sql", "0007_media_primary.sql", "0008_batch_02.sql", "0011_batch_05_customer_account.sql", "0012_batch_07_inventory_audit.sql", "0018_order_fulfillment_work.sql", "0019_shipping_address_snapshots.sql"]) {
    await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  }
  const db = drizzle(pg, { schema });
  await pg.exec(`
    insert into customers (id, mobile, full_name, status) values
      ('cust-a', '09120000001', 'آزاده', 'active'),
      ('cust-b', '09120000002', 'بهار', 'active');
    insert into admin_users (id, email, full_name, status) values ('admin-1', 'desk@example.com', 'مدیر', 'active');
    insert into settings (key, value) values ('shipping.sender_profile', '{"name":"شاهو","phone":"02100000000","province":"تهران","city":"تهران","address":"نشانی آزمایشی فرستنده","postalCode":"1234567890"}'::jsonb);
    insert into product_categories (id, slug, name, short_name) values ('cat-a', 'oils', 'روغن', 'روغن');
    insert into products (id, category_id, slug, sku, name, status) values ('prod-a', 'cat-a', 'prod-a', 'SKU-A', 'روغن', 'published');
    insert into product_variants (id, product_id, sku, label, price_irr) values ('var-a', 'prod-a', 'SKU-A-1', 'بسته', 1000);
    insert into inventory (variant_id, on_hand, reserved, low_stock_threshold) values ('var-a', 5, 1, 1);
    insert into orders (
      id, public_code, customer_id, status, payment_status, stock_state,
      full_name, mobile, province, city, address_line, subtotal_irr, total_irr
    ) values (
      'ord-a', 'SH-20261112-TEST', 'cust-a', 'awaiting_payment', 'unpaid', 'held',
      'آزاده', '09120000001', 'تهران', 'تهران', 'خیابان آزمایشی بلند', 1000, 1000
    );
    insert into order_items (id, order_id, variant_id, product_name, variant_label, sku, quantity, unit_price_irr, line_total_irr)
      values ('oi-a', 'ord-a', 'var-a', 'روغن', 'بسته', 'SKU-A-1', 1, 1000, 1000);
  `);
  return db;
}

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

test("addresses stay inside the owning account", async () => {
  const db = await database();
  const saved = await saveAddress(db, "cust-a", {
    label: "خانه",
    recipientName: "آزاده رضایی",
    recipientMobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلند",
    postalCode: "1234567890",
    plaque: "2",
    unit: "",
  });
  assert.equal(saved.ok, true);
  const other = await listAddresses(db, "cust-b");
  assert.equal(other.length, 0);
  if (saved.ok) {
    const removed = await saveAddress(db, "cust-b", { ...saved.addresses[0], id: saved.addresses[0]?.id });
    assert.equal(removed.ok, false);
  }
});

test("wishlist and reviews stay on the account and do not invent ratings", async () => {
  const db = await database();
  const saved = await toggleSaved(db, "cust-a", "prod-a");
  assert.equal(saved.ok, true);
  const merged = await mergeSaved(db, "cust-a", ["prod-a", "missing"]);
  assert.equal(merged.items.length, 1);
  const review = await submitReview(db, "cust-a", "آزاده", "prod-a", 5, "روغن را برای پخت استفاده کردم و خوب بود.");
  assert.equal(review.ok, true);
  const again = await submitReview(db, "cust-a", "آزاده", "prod-a", 4, "نظر دوم نباید همزمان باز بماند.");
  assert.equal(again.ok, false);
});

test("a verified capture moves stock once and a repeat does not", async () => {
  const db = await database();
  const first = await captureVerifiedPayment(db, { orderId: "ord-a", idempotencyKey: "pay-key-1", token: "mock-ok:mock-pay-key-1", provider });
  assert.equal(first.ok, true);
  const [stock] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(stock?.onHand, 4);
  assert.equal(stock?.reserved, 0);
  const second = await captureVerifiedPayment(db, { orderId: "ord-a", idempotencyKey: "pay-key-1", token: "mock-ok:mock-pay-key-1", provider });
  assert.equal(second.ok && second.already, true);
  const [again] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(again?.onHand, 4);
  const [order] = await db.select().from(orders).where(eq(orders.id, "ord-a"));
  assert.equal(order?.status, "paid");
  assert.equal(order?.paymentStatus, "verified");
});

test("support tickets are not visible to another customer and otp slots are atomic", async () => {
  const db = await database();
  const opened = await openTicket(db, "cust-a", "order", "پیگیری سفارش", "سفارش من هنوز در انتظار پرداخت است و سوال دارم.");
  assert.equal(opened.ok, true);
  assert.equal((await customerTickets(db, "cust-b")).length, 0);
  const now = Date.now();
  const mobileHash = throttleSubject("otp_mobile", "09120000001");
  const first = await reserveOtpSend(db, { mobileHash, ipHash: null, now });
  const second = await reserveOtpSend(db, { mobileHash, ipHash: null, now: now + 1000 });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
});

test("local upload rejects unsafe names and will not delete a referenced file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "shahoo-media-"));
  const previous = process.env.STORAGE_LOCAL_DIR;
  process.env.STORAGE_LOCAL_DIR = dir;
  try {
    const disk = new LocalDiskStorage(dir);
    await assert.rejects(() => disk.put("../secret.jpg", Uint8Array.from([1])));
    const db = await database();
    const jpeg = Buffer.from(
      "ffd8ffe000104a46494600010100000100010000ffdb00430006040506050406060506070706080a100a0a09090a140e0f0c1017141818171416161a1d251f1a1b231c1616202c20232627292a29191f2d302d283025282928ffdb0043010707070a080a130a0a13281a161a2828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00f1ea28a2b94f9c3fffd9",
      "hex",
    );
    const stored = await storeUploadedImage(db, "admin-1", jpeg, "روغن کنجد");
    assert.equal(stored.ok, true);
    const script = await storeUploadedImage(db, "admin-1", new TextEncoder().encode("#!/bin/sh\n"), "بد");
    assert.equal(script.ok, false);
    if (!stored.ok) return;
    const attached = await attachMediaToProduct(db, "admin-1", "prod-a", stored.id, true);
    assert.equal(attached.ok, true);
    const retired = await retireMedia(db, "admin-1", stored.id);
    assert.equal(retired.ok, false);
    const name = localObjectName(`local:${stored.id}.jpg`);
    assert.ok(name);
    assert.ok(await disk.read(name!));
  } finally {
    if (previous === undefined) delete process.env.STORAGE_LOCAL_DIR;
    else process.env.STORAGE_LOCAL_DIR = previous;
  }
});

test("shipment and refund stay ledger-only until a real gateway exists", async () => {
  const db = await database();
  await db.update(orders).set({ status: "ready_to_ship", paymentStatus: "verified", stockState: "captured" }).where(eq(orders.id, "ord-a"));
  const blocked = await recordShipment(db, "admin-1", "SH-20261112-TEST", {
    carrier: "",
    trackingCode: "FAKE",
    note: "نباید ثبت شود",
    handedOffAt: null,
  });
  assert.equal(blocked.ok, false);
  const missingShipmentReason = await recordShipment(db, "admin-1", "SH-20261112-TEST", {
    carrier: "پست",
    trackingCode: "TRK-100",
    note: "  ",
    handedOffAt: null,
  });
  assert.equal(missingShipmentReason.ok, false);
  const shipped = await recordShipment(db, "admin-1", "SH-20261112-TEST", {
    carrier: "پست",
    trackingCode: "TRK-100",
    note: "تحویل باجه",
    handedOffAt: "2026-11-12T12:00:00.000Z",
  });
  assert.equal(shipped.ok, true);
  const [shipmentAudit] = await db.select().from(auditLogs).where(eq(auditLogs.action, "order.shipment"));
  assert.equal(shipmentAudit?.metadata && (shipmentAudit.metadata as { reason?: string }).reason, "تحویل باجه");
  await db.update(orders).set({ status: "delivered" }).where(eq(orders.id, "ord-a"));
  const stranger = await requestReturn(db, "cust-b", "SH-20261112-TEST", "این سفارش مال من نیست ولی امتحان می‌کنم.");
  assert.equal(stranger.ok, false);
  const asked = await requestReturn(db, "cust-a", "SH-20261112-TEST", "بسته آسیب دیده به دستم رسید.");
  assert.equal(asked.ok, true);
  const [row] = await db.select({ id: returnRequests.id }).from(returnRequests).where(eq(returnRequests.orderId, "ord-a"));
  const returnId = row?.id;
  assert.ok(returnId);
  const missingReviewReason = await reviewReturn(db, "admin-1", returnId!, "approved", " ");
  assert.equal(missingReviewReason.ok, false);
  const reviewed = await reviewReturn(db, "admin-1", returnId!, "approved", "تأیید بررسی");
  assert.equal(reviewed.ok, true);
  const missingRefundReason = await recordRefund(db, "admin-1", returnId!, "partial", 400, " ");
  assert.equal(missingRefundReason.ok, false);
  const refund = await recordRefund(db, "admin-1", returnId!, "partial", 400, "استرداد بخشی از مبلغ");
  assert.equal(refund.ok, true);
  if (refund.ok) assert.match(refund.message, /انجام نشده/);
  const [reviewAudit] = await db.select().from(auditLogs).where(eq(auditLogs.action, "return.reviewed"));
  assert.equal(reviewAudit?.metadata && (reviewAudit.metadata as { reason?: string }).reason, "تأیید بررسی");
  const [refundAudit] = await db.select().from(auditLogs).where(eq(auditLogs.action, "return.recorded"));
  assert.equal(refundAudit?.metadata && (refundAudit.metadata as { reason?: string }).reason, "استرداد بخشی از مبلغ");
  const [order] = await db.select().from(orders).where(eq(orders.id, "ord-a"));
  assert.equal(order?.status, "partially_refunded");
  assert.equal(order?.paymentStatus, "partial_refund_recorded");
});

test("unpaid cancel releases a hold once and a paid cancel needs an internal refund", async () => {
  const db = await database();
  const missingReason = await moveOrderStatus(db, "admin-1", "SH-20261112-TEST", "cancelled", "  ");
  assert.equal(missingReason.ok, false);
  const invalidTransition = await moveOrderStatus(db, "admin-1", "SH-20261112-TEST", "delivered", "دلیل به‌تنهایی تغییر نامعتبر را مجاز نمی‌کند");
  assert.equal(invalidTransition.ok, false);
  const [stillHeld] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(stillHeld?.reserved, 1);
  const unpaid = await moveOrderStatus(db, "admin-1", "SH-20261112-TEST", "cancelled", "لغو به درخواست مشتری");
  assert.equal(unpaid.ok, true);
  const [stock] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(stock?.onHand, 5);
  assert.equal(stock?.reserved, 0);
  const again = await moveOrderStatus(db, "admin-1", "SH-20261112-TEST", "cancelled", "تکرار لغو");
  assert.equal(again.ok, false);
  const [still] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(still?.reserved, 0);
  const [cancelAudit] = await db.select().from(auditLogs).where(eq(auditLogs.action, "order.status"));
  assert.equal(cancelAudit?.entityId, "ord-a");
  assert.equal(cancelAudit?.metadata && (cancelAudit.metadata as { reason?: string }).reason, "لغو به درخواست مشتری");
  const cancellationEvents = await db.select().from(orderEvents).where(eq(orderEvents.orderId, "ord-a"));
  assert.equal(cancellationEvents.length, 1);
  assert.match(cancellationEvents[0]?.note ?? "", /دلیل: لغو به درخواست مشتری/);

  const paid = await database();
  await paid.update(orders).set({ status: "paid", paymentStatus: "verified", stockState: "captured" }).where(eq(orders.id, "ord-a"));
  await paid.update(inventory).set({ onHand: 4, reserved: 0 }).where(eq(inventory.variantId, "var-a"));
  // Batch 02 correction: a paid cancel needs a verified source payment to link the refund to.
  await paid.insert(payments).values({ id: "pay-a-ok", orderId: "ord-a", provider: "mock", status: "verified", amountIrr: 1000, currency: "IRR", idempotencyKey: "flow-paid-cancel" });
  const blocked = await moveOrderStatus(paid, "admin-1", "SH-20261112-TEST", "cancelled", "لغو پرداخت‌شده باید مسدود شود");
  assert.equal(blocked.ok, false);
  const settled = await settlePaidCancel(paid, "admin-1", "SH-20261112-TEST", "ثبت استرداد داخلی");
  assert.equal(settled.ok, true);
  const repeat = await settlePaidCancel(paid, "admin-1", "SH-20261112-TEST", "تکرار استرداد داخلی");
  assert.equal(repeat.ok && repeat.already, true);
  const [after] = await paid.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(after?.onHand, 5);
  const [closed] = await paid.select().from(orders).where(eq(orders.id, "ord-a"));
  assert.equal(closed?.status, "refunded");
  assert.equal(closed?.paymentStatus, "refund_recorded");
  assert.equal(closed?.stockState, "restocked");
});

test("two refunds cannot exceed the order total", async () => {
  const db = await database();
  await db.update(orders).set({ status: "delivered", paymentStatus: "verified", stockState: "captured", totalIrr: 1000 }).where(eq(orders.id, "ord-a"));
  await db.insert(returnRequests).values([
    { id: "ret-1", orderId: "ord-a", customerId: "cust-a", reason: "بسته آسیب دیده بود.", status: "approved", amountIrr: 0 },
    { id: "ret-2", orderId: "ord-a", customerId: "cust-a", reason: "بخشی از کالا کمبود داشت.", status: "approved", amountIrr: 0 },
  ]);
  const [first, second] = await Promise.all([
    recordRefund(db, "admin-1", "ret-1", "partial", 700, "استرداد مرجوعی اول"),
    recordRefund(db, "admin-1", "ret-2", "partial", 700, "استرداد مرجوعی دوم"),
  ]);
  assert.equal([first.ok, second.ok].filter(Boolean).length, 1);
  const rows = await db.select({ amountIrr: returnRequests.amountIrr }).from(returnRequests);
  const sum = rows.reduce((total, row) => total + Number(row.amountIrr), 0);
  assert.equal(sum <= 1000, true);
  assert.equal(sum, 700);
});

test("payment replay rejects a different order or amount", async () => {
  assert.equal(samePaymentReplay({ orderId: "ord-a", amountIrr: 1000 }, { orderId: "ord-a", amountIrr: 1000 }), true);
  assert.equal(samePaymentReplay({ orderId: "ord-a", amountIrr: 1000, currency: "IRR" }, { orderId: "ord-a", amountIrr: 1000, currency: "USD" }), false);
  const db = await database();
  const paid = await captureVerifiedPayment(db, { orderId: "ord-a", idempotencyKey: "pay-key-1", token: "mock-ok:mock-pay-key-1", provider });
  assert.equal(paid.ok, true);
  await db.insert(orders).values({
    id: "ord-b",
    publicCode: "SH-20261112-OTHR",
    customerId: "cust-a",
    status: "awaiting_payment",
    paymentStatus: "unpaid",
    stockState: "held",
    fullName: "آزاده",
    mobile: "09120000001",
    province: "تهران",
    city: "تهران",
    addressLine: "خیابان آزمایشی بلند",
    subtotalIrr: 1000,
    totalIrr: 1000,
  });
  const otherOrder = await captureVerifiedPayment(db, { orderId: "ord-b", idempotencyKey: "pay-key-1", token: "mock-ok:mock-pay-key-1", provider });
  assert.equal(otherOrder.ok, false);
  const [untouched] = await db.select().from(orders).where(eq(orders.id, "ord-b"));
  assert.equal(untouched?.status, "awaiting_payment");
  assert.equal(untouched?.paymentStatus, "unpaid");
  await db.update(orders).set({ totalIrr: 9000 }).where(eq(orders.id, "ord-a"));
  const otherAmount = await captureVerifiedPayment(db, { orderId: "ord-a", idempotencyKey: "pay-key-1", token: "mock-ok:mock-pay-key-1", provider });
  assert.equal(otherAmount.ok, false);
});

test("a mock payment provider cannot confirm money in production", () => {
  assert.equal(resolvePaymentProvider({ NODE_ENV: "production", PAYMENT_PROVIDER: "mock", ALLOW_MOCK_PAYMENT: "1" } as NodeJS.ProcessEnv), null);
  assert.equal(resolvePaymentProvider({ NODE_ENV: "test", PAYMENT_PROVIDER: "mock" } as NodeJS.ProcessEnv), null);
  const dev = resolvePaymentProvider({ NODE_ENV: "test", PAYMENT_PROVIDER: "mock", ALLOW_MOCK_PAYMENT: "1" } as NodeJS.ProcessEnv);
  assert.equal(dev?.key, "mock");
  assert.equal(dev?.configured({ NODE_ENV: "production", PAYMENT_PROVIDER: "mock", ALLOW_MOCK_PAYMENT: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(dev?.configured({ NODE_ENV: "test", PAYMENT_PROVIDER: "mock" } as NodeJS.ProcessEnv), false);
});

const jpeg = Buffer.from(
  "ffd8ffe000104a46494600010100000100010000ffdb00430006040506050406060506070706080a100a0a09090a140e0f0c1017141818171416161a1d251f1a1b231c1616202c20232627292a29191f2d302d283025282928ffdb0043010707070a080a130a0a13281a161a2828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00f1ea28a2b94f9c3fffd9",
  "hex",
);

test("return transitions reject illegal moves and do not restock", async () => {
  const db = await database();
  await db.update(orders).set({ status: "delivered", paymentStatus: "verified", stockState: "captured" }).where(eq(orders.id, "ord-a"));
  await db.update(inventory).set({ onHand: 4, reserved: 0 }).where(eq(inventory.variantId, "var-a"));
  const asked = await requestReturn(db, "cust-a", "SH-20261112-TEST", "بسته آسیب دیده به دستم رسید.");
  assert.equal(asked.ok, true);
  const again = await requestReturn(db, "cust-a", "SH-20261112-TEST", "درخواست دوم نباید باز شود.");
  assert.equal(again.ok, false);
  const [row] = await db.select().from(returnRequests).where(eq(returnRequests.orderId, "ord-a"));
  assert.ok(row);
  const jumped = await reviewReturn(db, "admin-1", row.id, "received", "دلیل بررسی");
  assert.equal(jumped.ok, false);
  const reviewed = await reviewReturn(db, "admin-1", row.id, "approved", "تأیید");
  assert.equal(reviewed.ok, true);
  if (reviewed.ok) {
    assert.equal(reviewed.row.status, "approved");
    assert.equal(reviewed.row.orderStatus, "delivered");
    assert.equal(reviewed.row.orderCode, "SH-20261112-TEST");
    assert.equal(reviewed.row.history.some((event) => event.status === "approved"), true);
  }
  const repeat = await reviewReturn(db, "admin-1", row.id, "approved", "دوباره");
  assert.equal(repeat.ok, false);
  const received = await reviewReturn(db, "admin-1", row.id, "received", "کالا بررسی و دریافت شد");
  assert.equal(received.ok, true);
  if (received.ok) {
    assert.equal(received.row.orderStatus, "returned");
    assert.equal(received.row.history.at(-1)?.status, "received");
  }
  const terminal = await reviewReturn(db, "admin-1", row.id, "rejected", "تغییر از وضعیت نهایی مجاز نیست");
  assert.equal(terminal.ok, false);
  const [stock] = await db.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(stock?.onHand, 4);
  const [order] = await db.select().from(orders).where(eq(orders.id, "ord-a"));
  assert.equal(order?.status, "returned");
  assert.equal(order?.stockState, "captured");
});

test("two return reviews cannot both win and a paid order is not marked returned", async () => {
  const db = await database();
  await db.insert(returnRequests).values({ id: "ret-race", orderId: "ord-a", customerId: "cust-a", reason: "آزمایش همزمان", status: "requested", amountIrr: 0 });
  const [approved, rejected] = await Promise.all([
    reviewReturn(db, "admin-1", "ret-race", "approved", "تأیید بررسی").catch((error) => ({ ok: false as const, message: String(error) })),
    reviewReturn(db, "admin-1", "ret-race", "rejected", "رد پس از بررسی").catch((error) => ({ ok: false as const, message: String(error) })),
  ]);
  assert.equal([approved.ok, rejected.ok].filter(Boolean).length, 1);
  const [row] = await db.select().from(returnRequests).where(eq(returnRequests.id, "ret-race"));
  assert.equal(row?.status === "approved" || row?.status === "rejected", true);
  const events = await db.select().from(returnEvents).where(eq(returnEvents.returnId, "ret-race"));
  assert.equal(events.length, 1);
  const paid = await database();
  await paid.update(orders).set({ status: "paid", paymentStatus: "verified", stockState: "captured" }).where(eq(orders.id, "ord-a"));
  await paid.update(inventory).set({ onHand: 4, reserved: 0 }).where(eq(inventory.variantId, "var-a"));
  await paid.insert(returnRequests).values({ id: "ret-paid", orderId: "ord-a", customerId: "cust-a", reason: "نباید سفارش را برگرداند", status: "approved", amountIrr: 0 });
  const got = await reviewReturn(paid, "admin-1", "ret-paid", "received", "دریافت شد بدون تغییر در سفارش پرداخت‌شده");
  assert.equal(got.ok, true);
  const [order] = await paid.select().from(orders).where(eq(orders.id, "ord-a"));
  assert.equal(order?.status, "paid");
  const [stock] = await paid.select().from(inventory).where(eq(inventory.variantId, "var-a"));
  assert.equal(stock?.onHand, 4);
});

test("a product keeps one primary image under concurrent attach", async () => {
  const dir = mkdtempSync(join(tmpdir(), "shahoo-primary-"));
  const previous = process.env.STORAGE_LOCAL_DIR;
  process.env.STORAGE_LOCAL_DIR = dir;
  try {
    const db = await database();
    const first = await storeUploadedImage(db, "admin-1", jpeg, "اول");
    const second = await storeUploadedImage(db, "admin-1", jpeg, "دوم");
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    const [left, right] = await Promise.all([
      attachMediaToProduct(db, "admin-1", "prod-a", first.id, true),
      attachMediaToProduct(db, "admin-1", "prod-a", second.id, true),
    ]);
    assert.equal(left.ok && right.ok, true);
    const images = await db.select().from(productImages).where(eq(productImages.productId, "prod-a"));
    assert.equal(images.length, 2);
    assert.equal(images.filter((image) => image.isPrimary).length, 1);
    const gallery = await attachMediaToProduct(db, "admin-1", "prod-a", second.id, false);
    assert.equal(gallery.ok, true);
    const still = await db.select().from(productImages).where(eq(productImages.productId, "prod-a"));
    assert.equal(still.length, 2);
    const extra = still.find((image) => !image.isPrimary);
    assert.ok(extra);
    const removed = await detachProductImage(db, "admin-1", extra.id);
    assert.equal(removed.ok, true);
    const primary = still.find((image) => image.isPrimary);
    assert.ok(primary);
    const blocked = await detachProductImage(db, "admin-1", primary.id);
    assert.equal(blocked.ok, false);
    const missing = await attachMediaToProduct(db, "admin-1", "prod-a", "med-missing", true);
    assert.equal(missing.ok, false);
    const after = await db.select().from(productImages).where(eq(productImages.productId, "prod-a"));
    assert.equal(after.filter((image) => image.isPrimary).length, 1);
    await assert.rejects(() =>
      db.insert(productImages).values({ id: "img-extra", productId: "prod-a", url: "/media/file/med-extra", isPrimary: true }),
    );
  } finally {
    if (previous === undefined) delete process.env.STORAGE_LOCAL_DIR;
    else process.env.STORAGE_LOCAL_DIR = previous;
  }
});

test("upload checks auth before the body and rejects a fake or oversized file", async () => {
  let reads = 0;
  const stream = new ReadableStream({
    pull(controller) {
      controller.close();
    },
  });
  const early = new Request("http://shop.local/api/media-upload", {
    method: "POST",
    headers: { "content-length": "99999999" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  const watched = new Proxy(early, {
    get(target, prop, receiver) {
      if (prop === "body") reads += 1;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const denied = await handleMediaUpload(watched, async () => {
    throw new SessionError("ورود مدیر لازم است.");
  });
  assert.equal(denied.status, 401);
  assert.equal(reads, 0);
  const forbidden = await handleMediaUpload(early, async () => {
    throw new SessionError("این دسترسی برای نقش شما فعال نیست.");
  });
  assert.equal(forbidden.status, 403);

  const lying = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(40));
      controller.close();
    },
  });
  const capped = await readBoundedBody(
    new Request("http://shop.local/api/media-upload", {
      method: "POST",
      headers: { "content-length": "5" },
      body: lying,
      duplex: "half",
    } as RequestInit),
    20,
  );
  assert.equal(capped.ok, false);

  const dir = mkdtempSync(join(tmpdir(), "shahoo-upload-"));
  const previous = process.env.STORAGE_LOCAL_DIR;
  process.env.STORAGE_LOCAL_DIR = dir;
  try {
    const db = await database();
    const authorize = async () => ({ db, admin: { id: "admin-1" } });
    const fake = new FormData();
    fake.set("file", new File([new TextEncoder().encode("<svg></svg>")], "../../etc/passwd.jpg", { type: "image/jpeg" }));
    fake.set("alt", "بد");
    const fakeResponse = await handleMediaUpload(new Request("http://shop.local/api/media-upload", { method: "POST", body: fake }), authorize);
    assert.equal(fakeResponse.status, 400);
    assert.equal((await db.select().from(mediaAssets)).length, 0);

    const evil = new FormData();
    evil.set("file", new File([jpeg], "../secret.php", { type: "text/plain" }));
    evil.set("alt", "روغن");
    const stored = await handleMediaUpload(new Request("http://shop.local/api/media-upload", { method: "POST", body: evil }), authorize);
    assert.equal(stored.status, 200);
    const [row] = await db.select().from(mediaAssets);
    assert.match(row?.filename ?? "", /^med-[A-Za-z0-9-]+\.jpg$/);
    assert.equal(row?.filename.includes("secret"), false);
    assert.equal((await db.select().from(mediaAssets)).length, 1);

    const huge = new Uint8Array(4 * 1024 * 1024 + 1);
    huge.set(jpeg.subarray(0, 3));
    const fat = new FormData();
    fat.set("file", new File([huge], "big.jpg", { type: "image/jpeg" }));
    const fatResponse = await handleMediaUpload(new Request("http://shop.local/api/media-upload", { method: "POST", body: fat }), authorize);
    assert.equal(fatResponse.status, 400);
    assert.equal((await db.select().from(mediaAssets)).length, 1);
  } finally {
    if (previous === undefined) delete process.env.STORAGE_LOCAL_DIR;
    else process.env.STORAGE_LOCAL_DIR = previous;
  }
});

test("a ticket thread stays with its owner and keeps every reply", async () => {
  const db = await database();
  const opened = await openTicket(db, "cust-a", "order", "پیگیری سفارش", "سفارش من هنوز در انتظار پرداخت است و سوال دارم.");
  assert.equal(opened.ok, true);
  const [ticket] = await customerTickets(db, "cust-a");
  assert.ok(ticket);
  const hidden = await ticketThread(db, ticket.id, "cust-b");
  assert.equal(hidden, null);
  const reply = await replyTicket(db, ticket.id, "admin", "admin-1", "در حال بررسی سفارش هستیم.", "reviewing");
  assert.equal(reply.ok, true);
  const thread = await ticketThread(db, ticket.id, "cust-a");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[0]?.authorType, "customer");
  assert.equal(thread?.messages[1]?.authorType, "admin");
  assert.equal(thread?.status, "reviewing");
});


test("server rejects WebP uploads until pixel decoding and re-encoding are supported", () => {
  const webpHeader = new Uint8Array(12);
  webpHeader.set([0x52, 0x49, 0x46, 0x46], 0);
  webpHeader.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(sanitizeImage(webpHeader), null);
});
