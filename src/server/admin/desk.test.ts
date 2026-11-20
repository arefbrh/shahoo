import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test, { before } from "node:test";
import { fileURLToPath } from "node:url";
import { requestHandler } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { updateCustomerProfile } from "../auth/customer.ts";
import { hashSessionToken } from "../auth/crypto.ts";
import { ADMIN_COOKIE, CUSTOMER_COOKIE } from "../auth/cookies.ts";
import { adjustInventory } from "../catalog/admin.ts";
import { loadOrder } from "../commerce/orders.ts";
import { getPglite } from "../../lib/db.ts";
import { getDb } from "../db/client.ts";
import { seedFoundation } from "../db/seed.ts";
import {
  adminRolePermissions,
  adminRoles,
  adminSessions,
  adminUserRoles,
  adminUsers,
  auditLogs,
  customerAddresses,
  customerSessions,
  customers,
  inventory,
  inventoryLogs,
  orderItems,
  orders,
  productCategories,
  productVariants,
  products,
} from "../db/schema.ts";
import { loadAdminOrders, loadCustomer, loadCustomers, loadInventoryDesk, setCustomerStatus } from "./desk.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const tokens = {
  superAdmin: "revision01-super-admin-session-token",
  support: "revision01-support-session-token",
  ordersOnly: "revision01-orders-only-session-token",
  contentOnly: "revision01-content-only-session-token",
  productManager: "revision01-product-manager-session-token",
  customer: "revision01-customer-session-token",
};
const targetCustomerId = "customer-target";
const targetOrderCode = "SH-20261119-O001";
const variantId = "variant-inventory-audit";

let db: Awaited<ReturnType<typeof getDb>>;

async function inRequest<T>(operation: () => Promise<T>, token?: string, cookie = ADMIN_COOKIE): Promise<T> {
  let result!: T;
  const handler = requestHandler(async () => {
    result = await operation();
    return new Response("ok");
  });
  const headers = token ? { cookie: `${cookie}=${token}` } : undefined;
  await handler(new Request("https://shahoo.test/admin", { headers }), {});
  return result;
}

async function addAdmin(id: string, name: string, roleId: string, token: string): Promise<void> {
  await db.insert(adminUsers).values({ id, fullName: name, email: `${id}@example.test`, status: "active" });
  await db.insert(adminUserRoles).values({ adminUserId: id, roleId });
  await db.insert(adminSessions).values({
    id: `session-${id}`,
    adminUserId: id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
}

before(async () => {
  const pg = await getPglite();
  const migrationFiles = readdirSync(join(root, "migrations")).filter((name) => name.endsWith(".sql")).sort();
  for (const name of migrationFiles) await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  db = await getDb();
  await seedFoundation(db);

  await db.insert(adminRoles).values({ id: "role-orders-only", key: "orders_only_test", name: "سفارش فقط" });
  await db.insert(adminRolePermissions).values({ roleId: "role-orders-only", permissionId: "perm-orders.read" });
  await addAdmin("admin-super-test", "مدیر ارشد آزمون", "role-super_admin", tokens.superAdmin);
  await addAdmin("admin-support-test", "پشتیبانی آزمون", "role-customer_support", tokens.support);
  await addAdmin("admin-orders-test", "مدیر سفارش آزمون", "role-orders-only", tokens.ordersOnly);
  await addAdmin("admin-content-test", "مدیر محتوا آزمون", "role-content_manager", tokens.contentOnly);
  await addAdmin("admin-inventory-test", "مدیر محصول آزمون", "role-product_manager", tokens.productManager);

  const customerRows = [
    { id: targetCustomerId, mobile: "09123456789", fullName: "آزاده رضایی", firstName: "آزاده", lastName: "رضایی", status: "active" },
    ...Array.from({ length: 22 }, (_, index) => ({
      id: `customer-test-${String(index + 1).padStart(2, "0")}`,
      mobile: `0912000${String(index + 1).padStart(4, "0")}`,
      fullName: `مشتری آزمایشی ${String(index + 1).padStart(2, "0")}`,
      firstName: "مشتری",
      lastName: `آزمایشی ${String(index + 1).padStart(2, "0")}`,
      status: "active",
    })),
  ];
  await db.insert(customers).values(customerRows);
  await db.insert(customerSessions).values({
    id: "session-customer-target",
    customerId: targetCustomerId,
    tokenHash: hashSessionToken(tokens.customer),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await db.insert(customerAddresses).values({
    id: "address-customer-target",
    customerId: targetCustomerId,
    label: "خانه",
    recipientName: "آزاده رضایی",
    recipientMobile: "09123456789",
    province: "تهران",
    city: "تهران",
    addressLine: "نشانی آزمایشی برای نمایه مشتری",
    postalCode: "1234567890",
    isDefault: true,
  });

  const createdBase = new Date("2026-11-01T00:00:00.000Z");
  await db.insert(orders).values(
    Array.from({ length: 25 }, (_, index) => ({
      id: `order-test-${String(index + 1).padStart(3, "0")}`,
      publicCode: `SH-20261119-O${String(index + 1).padStart(3, "0")}`,
      customerId: targetCustomerId,
      status: "awaiting_payment",
      paymentStatus: "unpaid",
      stockState: "held",
      fullName: "آزاده رضایی",
      mobile: "09123456789",
      province: "تهران",
      city: "تهران",
      addressLine: "نشانی سفارش آزمایشی",
      subtotalIrr: 100_000,
      totalIrr: 100_000,
      createdAt: new Date(createdBase.getTime() + index * 60_000),
      updatedAt: new Date(createdBase.getTime() + index * 60_000),
    })),
  );
  await db.insert(orderItems).values({
    id: "order-item-test-001",
    orderId: "order-test-001",
    variantId: null,
    productName: "محصول آزمایشی",
    variantLabel: "بسته",
    sku: "TEST-ORDER-ITEM",
    quantity: 2,
    unitPriceIrr: 50_000,
    lineTotalIrr: 100_000,
  });

  await db.insert(productCategories).values({ id: "category-inventory-test", slug: "inventory-test", name: "موجودی آزمون", shortName: "آزمون" });
  await db.insert(products).values({
    id: "product-inventory-test",
    categoryId: "category-inventory-test",
    slug: "inventory-audit-test",
    sku: "INVENTORY-AUDIT-TEST",
    name: "محصول موجودی آزمون",
    status: "published",
  });
  await db.insert(productVariants).values({
    id: variantId,
    productId: "product-inventory-test",
    sku: "INVENTORY-AUDIT-TEST-01",
    label: "بسته آزمایشی",
    unitKind: "custom",
    priceIrr: 100_000,
    status: "active",
  });
  await db.insert(inventory).values({ variantId, onHand: 10, reserved: 3, lowStockThreshold: 2 });
});

const emptyOrderFilters = { q: "", status: "", paymentStatus: "", from: "", to: "", page: 1 };

test("admin order/customer desks enforce permissions, privacy, search, and bounded pagination", async () => {
  const unauthorizedOrders = await inRequest(() => loadAdminOrders(emptyOrderFilters));
  assert.equal(unauthorizedOrders.denied, true);
  const deniedByRole = await inRequest(() => loadAdminOrders(emptyOrderFilters), tokens.contentOnly);
  assert.equal(deniedByRole.denied, true);

  const listedOrders = await inRequest(
    () => loadAdminOrders({ ...emptyOrderFilters, status: "awaiting_payment", paymentStatus: "unpaid", page: 2 }),
    tokens.support,
  );
  assert.equal(listedOrders.denied, false);
  if (listedOrders.denied) return;
  assert.equal(listedOrders.total, 25);
  assert.equal(listedOrders.page, 2);
  assert.equal(listedOrders.pages, 2);
  assert.equal(listedOrders.rows.length, 5);
  assert.equal(listedOrders.rows[0]?.customerMobile, "09123456789");

  const searchedOrder = await inRequest(
    () => loadAdminOrders({ ...emptyOrderFilters, q: "O001", page: 1 }),
    tokens.support,
  );
  assert.equal(searchedOrder.denied, false);
  if (!searchedOrder.denied) assert.deepEqual(searchedOrder.rows.map((row) => row.publicCode), [targetOrderCode]);

  const privacyLimitedOrderDesk = await inRequest(() => loadAdminOrders(emptyOrderFilters), tokens.ordersOnly);
  assert.equal(privacyLimitedOrderDesk.denied, false);
  if (!privacyLimitedOrderDesk.denied) {
    assert.equal(privacyLimitedOrderDesk.canSearchMobile, false);
    assert.equal(privacyLimitedOrderDesk.rows[0]?.customerName, "");
    assert.equal(privacyLimitedOrderDesk.rows[0]?.customerMobile, "");
  }
  const privacyLimitedOrderDetail = await inRequest(() => loadOrder(targetOrderCode), tokens.ordersOnly);
  assert.equal(privacyLimitedOrderDetail?.fullName, "مشتری");
  assert.notEqual(privacyLimitedOrderDetail?.mobile, "09123456789");
  assert.match(privacyLimitedOrderDetail?.mobile ?? "", /\*/);
  assert.equal(privacyLimitedOrderDetail?.addressLine, "نشانی فقط با دسترسی مشتریان دیده می‌شود.");
  const authorizedOrderDetail = await inRequest(() => loadOrder(targetOrderCode), tokens.support);
  assert.equal(authorizedOrderDetail?.fullName, "آزاده رضایی");
  assert.equal(authorizedOrderDetail?.mobile, "09123456789");
  assert.equal(await inRequest(() => loadOrder(targetOrderCode)), null);

  const noCustomerAccess = await inRequest(() => loadCustomers({ q: "", page: 1 }), tokens.contentOnly);
  assert.equal(noCustomerAccess.denied, true);
  const customerPage = await inRequest(() => loadCustomers({ q: "", page: 2 }), tokens.support);
  assert.equal(customerPage.denied, false);
  if (!customerPage.denied) {
    assert.equal(customerPage.total, 23);
    assert.equal(customerPage.pages, 2);
    assert.equal(customerPage.page, 2);
    assert.equal(customerPage.rows.length, 3);
    assert.equal("mobile" in (customerPage.rows[0] ?? {}), false);
    assert.match(customerPage.rows[0]?.mobileMasked ?? "", /\*/);
  }
  const searchedCustomer = await inRequest(() => loadCustomers({ q: "مشتری آزمایشی 02", page: 1 }), tokens.support);
  assert.equal(searchedCustomer.denied, false);
  if (!searchedCustomer.denied) assert.equal(searchedCustomer.rows[0]?.id, "customer-test-02");

  const anonymousCustomerDetail = await inRequest(() => loadCustomer(targetCustomerId));
  assert.ok(!anonymousCustomerDetail || anonymousCustomerDetail.denied);
  const unauthorizedCustomerDetail = await inRequest(() => loadCustomer(targetCustomerId), tokens.contentOnly);
  assert.ok(!unauthorizedCustomerDetail || unauthorizedCustomerDetail.denied);
  const customerDetail = await inRequest(() => loadCustomer(targetCustomerId), tokens.support);
  assert.equal(customerDetail?.denied, false);
  if (customerDetail && !customerDetail.denied) {
    assert.equal(customerDetail.mobile, "09123456789");
    assert.equal(customerDetail.orderCount, 25);
    assert.equal(customerDetail.orders.length, 20);
    assert.equal(customerDetail.addresses[0]?.addressLine, "نشانی آزمایشی برای نمایه مشتری");
    assert.equal(customerDetail.canWrite, false);
  }
});

test("customer status mutation requires write permission and an audited reason without changing the verified mobile", async () => {
  const noReason = await inRequest(() => setCustomerStatus(targetCustomerId, "blocked", "  "), tokens.superAdmin);
  assert.equal(noReason.ok, false);
  const noWritePermission = await inRequest(() => setCustomerStatus(targetCustomerId, "blocked", "بررسی مدیریتی"), tokens.support);
  assert.equal(noWritePermission.ok, false);
  const invalidState = await inRequest(() => setCustomerStatus(targetCustomerId, "deleted", "درخواست نامعتبر"), tokens.superAdmin);
  assert.equal(invalidState.ok, false);
  const [before] = await db.select().from(customers).where(eq(customers.id, targetCustomerId));
  assert.equal(before?.status, "active");
  assert.equal((await db.select().from(auditLogs).where(eq(auditLogs.action, "customer.status_updated"))).length, 0);

  const ownProfile = await inRequest(
    () => updateCustomerProfile({ firstName: "آزاده", lastName: "رضایی ویرایش‌شده", gender: null, ageGroup: null }),
    tokens.customer,
    CUSTOMER_COOKIE,
  );
  assert.equal(ownProfile.ok, true);
  const [afterProfile] = await db.select().from(customers).where(eq(customers.id, targetCustomerId));
  assert.equal(afterProfile?.mobile, "09123456789");

  const changed = await inRequest(() => setCustomerStatus(targetCustomerId, "blocked", "  درخواست کارشناس؛ احراز دوباره  "), tokens.superAdmin);
  assert.equal(changed.ok, true);
  const [after] = await db.select().from(customers).where(eq(customers.id, targetCustomerId));
  assert.equal(after?.status, "blocked");
  assert.equal(after?.mobile, "09123456789");
  const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.action, "customer.status_updated"));
  assert.equal(audit?.actorId, "admin-super-test");
  assert.equal(audit?.entityId, targetCustomerId);
  assert.deepEqual(audit?.metadata, { from: "active", to: "blocked", reason: "درخواست کارشناس؛ احراز دوباره" });
  const blockedFilter = await inRequest(() => loadCustomers({ q: "", page: 1, status: "blocked" }), tokens.support);
  assert.equal(blockedFilter.denied, false);
  if (!blockedFilter.denied) assert.deepEqual(blockedFilter.rows.map((row) => row.id), [targetCustomerId]);
});

test("inventory desk and adjustments enforce permissions, stock bounds, snapshots, reason history, audit, and PGlite race behavior", async () => {
  const deniedList = await inRequest(() => loadInventoryDesk({ q: "", categoryId: "", stock: "", page: 1, logPage: 1 }), tokens.contentOnly);
  assert.equal(deniedList.denied, true);
  const listed = await inRequest(
    () => loadInventoryDesk({ q: "INVENTORY-AUDIT-TEST-01", categoryId: "", stock: "", page: 1, logPage: 1 }),
    tokens.productManager,
  );
  assert.equal(listed.denied, false);
  if (!listed.denied) {
    const row = listed.rows.find((item) => item.variantId === variantId);
    assert.ok(row);
    assert.equal(row?.onHand, 10);
    assert.equal(row?.reserved, 3);
    assert.equal(row?.sellable, 7);
    assert.equal(row?.sellable, row!.onHand - row!.reserved);
  }

  const noWriteRole = await inRequest(() => adjustInventory(variantId, 1, "اصلاح شمارش"), tokens.support);
  assert.equal(noWriteRole.ok, false);
  const noReason = await inRequest(() => adjustInventory(variantId, 1, " "), tokens.superAdmin);
  assert.equal(noReason.ok, false);
  const zeroDelta = await inRequest(() => adjustInventory(variantId, 0, "شمارش بدون تغییر"), tokens.superAdmin);
  assert.equal(zeroDelta.ok, false);
  const belowReserved = await inRequest(() => adjustInventory(variantId, -8, "اصلاح بیش از حد"), tokens.superAdmin);
  assert.equal(belowReserved.ok, false);
  const [unchanged] = await db.select().from(inventory).where(eq(inventory.variantId, variantId));
  assert.equal(unchanged?.onHand, 10);
  assert.equal(unchanged?.reserved, 3);
  assert.equal((await db.select().from(inventoryLogs).where(eq(inventoryLogs.variantId, variantId))).length, 0);

  const adjusted = await inRequest(() => adjustInventory(variantId, 2, "شمارش فیزیکی؛ افزایش دو واحد"), tokens.superAdmin);
  assert.equal(adjusted.ok, true);
  const [after] = await db.select().from(inventory).where(eq(inventory.variantId, variantId));
  assert.equal(after?.onHand, 12);
  assert.equal(after?.reserved, 3);
  const [movement] = await db.select().from(inventoryLogs).where(eq(inventoryLogs.variantId, variantId));
  assert.equal(movement?.delta, 2);
  assert.equal(movement?.note, "شمارش فیزیکی؛ افزایش دو واحد");
  assert.equal(movement?.onHandBefore, 10);
  assert.equal(movement?.onHandAfter, 12);
  assert.equal(movement?.reservedBefore, 3);
  assert.equal(movement?.reservedAfter, 3);
  assert.equal(movement?.actorAdminId, "admin-super-test");
  const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.action, "inventory.adjusted"));
  assert.equal(audit?.actorId, "admin-super-test");
  assert.equal(audit?.entityId, variantId);

  const deskHistory = await inRequest(
    () => loadInventoryDesk({ q: "INVENTORY-AUDIT-TEST-01", categoryId: "", stock: "", page: 1, logPage: 1 }),
    tokens.productManager,
  );
  assert.equal(deskHistory.denied, false);
  if (!deskHistory.denied) {
    const log = deskHistory.logs.find((item) => item.id === movement?.id);
    assert.equal(log?.note, "شمارش فیزیکی؛ افزایش دو واحد");
    assert.equal(log?.onHandBefore, 10);
    assert.equal(log?.onHandAfter, 12);
    assert.equal(log?.reservedBefore, 3);
    assert.equal(log?.reservedAfter, 3);
  }

  await db.update(inventory).set({ onHand: 10, reserved: 3 }).where(eq(inventory.variantId, variantId));
  const concurrent = await Promise.all([
    inRequest(() => adjustInventory(variantId, -4, "آزمون هم‌زمان اول"), tokens.superAdmin),
    inRequest(() => adjustInventory(variantId, -4, "آزمون هم‌زمان دوم"), tokens.superAdmin),
  ]);
  assert.equal(concurrent.filter((result) => result.ok).length, 1);
  const [afterRace] = await db.select().from(inventory).where(eq(inventory.variantId, variantId));
  assert.equal(afterRace?.onHand, 6);
  assert.equal(afterRace?.reserved, 3);
});
