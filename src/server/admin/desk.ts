import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type {
  AdminOrderList,
  CustomerDetail,
  CustomerList,
  DashboardData,
  DashboardRange,
  DeskDenied,
  InventoryDesk,
  ReportsData,
  StaffDesk,
} from "@/lib/admin-types";
import type { OrderSummary } from "@/lib/commerce-types";
import { demographicDistribution } from "@/lib/customer-demographics";
import { tehranDayEnd, tehranDayKey, tehranDayStart } from "@/lib/tehran-time";
import { formatTomanFromIrr, toPersianNum } from "@/lib/format";
import { FULFILLMENT_STATUSES } from "@/lib/order-flow";
import { hasUnsafeText } from "@/lib/text-safety";
import { applyStaffChange } from "./access-control";
import { writeAudit } from "../auth/audit";
import { SessionError, requireAdmin, requireAdminAny } from "../auth/guard";
import { maskMobile, normalizeIranMobile } from "../auth/mobile";
import type { AdminPrincipal } from "../auth/sessions";
import type { AppDatabase } from "../db/client";
import {
  adminRoles,
  adminUserRoles,
  adminUsers,
  adminSessions,
  auditLogs,
  coupons,
  customerAddresses,
  customers,
  inventory,
  inventoryLogs,
  opsDiagnostics,
  orderItems,
  orders,
  payments,
  productCategories,
  productVariants,
  products,
} from "../db/schema";
import { orderStatusLabel, paymentStatusLabel } from "../commerce/pricing";

const PAGE = 20;

const ACTION_LABELS: Record<string, string> = {
  "admin.login": "ورود مدیر",
  "admin.login_failed": "ورود ناموفق مدیر",
  "admin.login_locked": "قفل موقت ورود مدیر",
  "admin.logout": "خروج مدیر",
  "admin.roles_updated": "تغییر نقش مدیر",
  "customer.status_updated": "تغییر وضعیت مشتری",
  "order.placed": "ثبت سفارش پرداخت‌نشده",
  "order.hold_released": "آزاد شدن موجودی رزرو",
  "order.cancelled": "لغو سفارش پرداخت‌نشده",
  "catalog.category_saved": "ذخیره دسته",
  "catalog.product_saved": "ذخیره محصول",
  "inventory.adjusted": "اصلاح موجودی",
  "inventory.inconsistent": "ناسازگاری رزرو موجودی",
  "coupon.saved": "ذخیره کد تخفیف",
  "shipping.saved": "ذخیره روش ارسال",
};

const ACTOR_LABELS: Record<string, string> = {
  customer: "مشتری",
  admin: "مدیر",
  anonymous: "ناشناس",
  system: "سامانه",
};

function fa(value: Date | string | number | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function denied(error: unknown): DeskDenied {
  if (error instanceof SessionError) return { denied: true, message: error.message };
  throw error;
}

function has(admin: AdminPrincipal, key: string): boolean {
  return admin.permissions.includes(key);
}

function rangeStart(range: DashboardRange, now: Date): Date | null {
  if (range === "all") return null;
  if (range === "today") return tehranDayStart(tehranDayKey(now));
  const days = range === "7" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function ledgerNote(db: AppDatabase, start?: Date | null): Promise<string> {
  const [verified] = await db
    .select({
      n: count(),
      total: sql<string | number>`coalesce(sum(${payments.amountIrr}), 0)`,
    })
    .from(payments)
    .where(start ? and(eq(payments.status, "verified"), gte(payments.createdAt, start)) : eq(payments.status, "verified"));
  const [refunded] = await db
    .select({
      total: sql<string | number>`coalesce(sum(${payments.amountIrr}), 0)`,
    })
    .from(payments)
    .where(start ? and(inArray(payments.status, ["refund_recorded", "partial_refund_recorded"]), gte(payments.createdAt, start)) : inArray(payments.status, ["refund_recorded", "partial_refund_recorded"]));
  if (num(verified?.n) === 0) {
    return "درآمد تأییدشده: صفر. هیچ پرداخت بررسی‌شده‌ای ثبت نشده و مبلغ سفارش‌های باز درآمد حساب نمی‌شود.";
  }
  return `پرداخت تأییدشده در دفتر: ${formatTomanFromIrr(num(verified?.total))} (${toPersianNum(num(verified?.n))} مورد). استرداد دفتری: ${formatTomanFromIrr(num(refunded?.total))}. این رقم تسویه بانکی نیست و تا اتصال درگاه، دریافت وجه واقعی حساب نمی‌شود.`;
}

export async function loadDashboard(rangeInput: string): Promise<DashboardData | DeskDenied> {
  try {
    const { db, admin } = await requireAdmin();
    const range: DashboardRange = rangeInput === "today" || rangeInput === "7" || rangeInput === "all" ? rangeInput : "30";
    const start = rangeStart(range, new Date());
    const cards: DashboardData["cards"] = [];
    if (has(admin, "catalog.read") || has(admin, "reports.read")) {
      const [productCount] = await db.select({ n: count() }).from(products).where(isNull(products.deletedAt));
      const [published] = await db
        .select({ n: count() })
        .from(products)
        .where(and(isNull(products.deletedAt), eq(products.status, "published")));
      const [categoryCount] = await db.select({ n: count() }).from(productCategories).where(isNull(productCategories.deletedAt));
      const [variantCount] = await db
        .select({ n: count() })
        .from(productVariants)
        .where(and(isNull(productVariants.deletedAt), eq(productVariants.status, "active")));
      cards.push(
        { label: "محصول", value: String(num(productCount?.n)) },
        { label: "منتشرشده", value: String(num(published?.n)) },
        { label: "دسته", value: String(num(categoryCount?.n)) },
        { label: "بسته فعال", value: String(num(variantCount?.n)) },
      );
    }
    if (has(admin, "inventory.read") || has(admin, "inventory.write") || has(admin, "reports.read")) {
      const [low] = await db
        .select({ n: count() })
        .from(inventory)
        .where(sql`${inventory.onHand} - ${inventory.reserved} <= ${inventory.lowStockThreshold}`);
      cards.push({ label: "کم‌موجود", value: String(num(low?.n)), hint: "قابل فروش به آستانه رسیده" });
    }
    if (has(admin, "customers.read") || has(admin, "reports.read")) {
      const where = start ? and(isNull(customers.deletedAt), gte(customers.createdAt, start)) : isNull(customers.deletedAt);
      const [customerCount] = await db.select({ n: count() }).from(customers).where(where);
      cards.push({ label: "مشتری", value: String(num(customerCount?.n)), hint: start ? "در بازه انتخاب‌شده" : "همه" });
    }
    if (has(admin, "orders.read") || has(admin, "reports.read")) {
      const orderWhere = start ? gte(orders.createdAt, start) : undefined;
      const grouped = await db
        .select({ status: orders.status, n: count() })
        .from(orders)
        .where(orderWhere)
        .groupBy(orders.status);
      const byStatus = new Map(grouped.map((row) => [row.status, num(row.n)]));
      const total = [...byStatus.values()].reduce((sum, value) => sum + value, 0);
      cards.push(
        { label: "سفارش", value: String(total), hint: "درآمد نیست" },
        { label: "در انتظار پرداخت", value: String(byStatus.get("awaiting_payment") ?? 0) },
        { label: "لغو شده", value: String(byStatus.get("cancelled") ?? 0) },
        { label: "منقضی", value: String(byStatus.get("expired") ?? 0) },
      );
    }
    const revenueNote =
      has(admin, "orders.read") || has(admin, "reports.read")
        ? await ledgerNote(db)
        : "گزارش درآمد برای این نقش فعال نیست.";

    const recentOrders = has(admin, "orders.read") ? await latestOrders(db, 8) : [];
    const audits = has(admin, "reports.read") ? await latestAudits(db) : [];
    const diagnostics =
      has(admin, "inventory.read") || has(admin, "inventory.write") || has(admin, "reports.read")
        ? await latestDiagnostics(db)
        : [];
    return { denied: false, range, cards, revenueNote, recentOrders, audits, diagnostics };
  } catch (error) {
    return denied(error);
  }
}

export async function loadAdminOrders(input: {
  q: string;
  status: string;
  paymentStatus?: string;
  from: string;
  to: string;
  page: number;
}): Promise<AdminOrderList | DeskDenied> {
  try {
    const { db, admin } = await requireAdmin("orders.read");
    const q = input.q.trim().slice(0, 40);
    const status = (FULFILLMENT_STATUSES as readonly string[]).includes(input.status) ? input.status : "";
    const paymentStatus = ["unpaid", "pending", "verified", "failed", "expired", "refund_recorded", "partial_refund_recorded"].includes(input.paymentStatus ?? "") ? input.paymentStatus! : "";
    const from = input.from.trim();
    const to = input.to.trim();
    const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
    const canSearchMobile = has(admin, "customers.read");
    if ((from && !tehranDayStart(from)) || (to && !tehranDayEnd(to))) {
      return { denied: false, rows: [], page: 1, pages: 1, total: 0, q, status, paymentStatus, from, to, canSearchMobile, error: "تاریخ را با تقویم تهران وارد کنید." };
    }
    const filters = [];
    if (status) filters.push(eq(orders.status, status));
    if (paymentStatus) filters.push(eq(orders.paymentStatus, paymentStatus));
    if (from) filters.push(gte(orders.createdAt, tehranDayStart(from)!));
    if (to) filters.push(lte(orders.createdAt, tehranDayEnd(to)!));
    if (q) {
      const mobile = normalizeIranMobile(q);
      if (mobile && canSearchMobile) filters.push(eq(orders.mobile, mobile));
      else filters.push(ilike(orders.publicCode, `%${q.replace(/[%_]/g, "")}%`));
    }
    const where = filters.length ? and(...filters) : undefined;
    const [totalRow] = await db.select({ n: count() }).from(orders).where(where);
    const total = num(totalRow?.n);
    const pages = Math.max(1, Math.ceil(total / PAGE));
    const safePage = Math.min(page, pages);
    const rows = await db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(PAGE)
      .offset((safePage - 1) * PAGE);
    const summaries = await withCounts(db, rows);
    return {
      denied: false,
      rows: summaries.map((row, index) => ({
        ...row,
        shippingTitle: rows[index]?.shippingTitle ?? "",
        couponCode: rows[index]?.couponCode ?? null,
        customerName: has(admin, "customers.read") ? rows[index]?.fullName || "" : "",
        customerMobile: has(admin, "customers.read") ? rows[index]?.mobile || "" : "",
      })),
      page: safePage,
      pages,
      total,
      q,
      status,
      paymentStatus,
      from,
      to,
      canSearchMobile,
      error: "",
    };
  } catch (error) {
    return denied(error);
  }
}

export async function loadCustomers(input: { q: string; page: number; status?: string; from?: string; to?: string }): Promise<CustomerList | DeskDenied> {
  try {
    const { db } = await requireAdmin("customers.read");
    const q = input.q.trim().slice(0, 40);
    const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
    const status = ["active", "blocked"].includes(input.status ?? "") ? input.status! : "";
    const from = (input.from ?? "").trim();
    const to = (input.to ?? "").trim();
    if ((from && !tehranDayStart(from)) || (to && !tehranDayEnd(to))) {
      return { denied: false, rows: [], page: 1, pages: 1, total: 0, q, status, from, to, error: "تاریخ را با تقویم تهران وارد کنید." };
    }
    const mobile = normalizeIranMobile(q);
    const filters = [isNull(customers.deletedAt)];
    if (q) filters.push(mobile ? eq(customers.mobile, mobile) : ilike(customers.fullName, `%${q.replace(/[%_]/g, "")}%`));
    if (status) filters.push(eq(customers.status, status));
    if (from) filters.push(gte(customers.createdAt, tehranDayStart(from)!));
    if (to) filters.push(lte(customers.createdAt, tehranDayEnd(to)!));
    const where = and(...filters);
    const [totalRow] = await db.select({ n: count() }).from(customers).where(where);
    const total = num(totalRow?.n);
    const pages = Math.max(1, Math.ceil(total / PAGE));
    const safePage = Math.min(page, pages);
    const rows = await db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        mobile: customers.mobile,
        status: customers.status,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(PAGE)
      .offset((safePage - 1) * PAGE);
    const ids = rows.map((row) => row.id);
    const counts = ids.length
      ? await db.select({ customerId: orders.customerId, n: count(), totalIrr: sql<number>`coalesce(sum(${orders.totalIrr}), 0)`, recentOrderAt: sql<Date | string | null>`max(${orders.createdAt})` }).from(orders).where(inArray(orders.customerId, ids)).groupBy(orders.customerId)
      : [];
    const byCustomer = new Map(counts.map((row) => [row.customerId, { count: num(row.n), totalIrr: num(row.totalIrr), recentOrderAt: row.recentOrderAt }]));
    return {
      denied: false,
      rows: rows.map((row) => ({
        id: row.id,
        fullName: row.fullName || "بدون نام",
        mobileMasked: row.mobile ? maskMobile(row.mobile) : "—",
        status: row.status,
        statusLabel: customerStatusLabel(row.status),
        orderCount: byCustomer.get(row.id)?.count ?? 0,
        totalIrr: byCustomer.get(row.id)?.totalIrr ?? 0,
        latestOrderAtLabel: fa(byCustomer.get(row.id)?.recentOrderAt),
        createdAtLabel: fa(row.createdAt),
      })),
      page: safePage,
      pages,
      total,
      q,
      status,
      from,
      to,
      error: "",
    };
  } catch (error) {
    return denied(error);
  }
}

export async function loadCustomer(id: string): Promise<CustomerDetail | DeskDenied | null> {
  try {
    const { db, admin } = await requireAdmin("customers.read");
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return null;
    const [row] = await db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        mobile: customers.mobile,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
        gender: customers.gender,
        ageGroup: customers.ageGroup,
        status: customers.status,
        createdAt: customers.createdAt,
        deletedAt: customers.deletedAt,
      })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    if (!row || row.deletedAt || !row.mobile) return null;
    const orderRows = await db.select().from(orders).where(eq(orders.customerId, row.id)).orderBy(desc(orders.createdAt)).limit(20);
    const summaries = await withCounts(db, orderRows);
    const [sum] = await db
      .select({ n: count(), total: sql<number>`coalesce(sum(${orders.totalIrr}), 0)` })
      .from(orders)
      .where(eq(orders.customerId, row.id));
    const addressRows = await db.select({ id: customerAddresses.id, label: customerAddresses.label, recipientName: customerAddresses.recipientName, recipientMobile: customerAddresses.recipientMobile, province: customerAddresses.province, city: customerAddresses.city, addressLine: customerAddresses.addressLine, postalCode: customerAddresses.postalCode, plaque: customerAddresses.plaque, unit: customerAddresses.unit, isDefault: customerAddresses.isDefault }).from(customerAddresses).where(and(eq(customerAddresses.customerId, row.id), isNull(customerAddresses.deletedAt))).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt));
    return {
      denied: false,
      id: row.id,
      fullName: row.fullName || "بدون نام",
      mobile: row.mobile,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      gender: row.gender,
      ageGroup: row.ageGroup,
      addresses: addressRows,
      status: row.status,
      statusLabel: customerStatusLabel(row.status),
      createdAtLabel: fa(row.createdAt),
      orderCount: num(sum?.n),
      totalIrr: num(sum?.total),
      orders: summaries,
      canWrite: has(admin, "customers.write"),
    };
  } catch (error) {
    return denied(error);
  }
}

export async function setCustomerStatus(id: string, status: string, reason: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { db, admin } = await requireAdmin("customers.write");
    if (status !== "active" && status !== "blocked") return { ok: false, message: "وضعیت مشتری معتبر نیست." };
    const cleanReason = reason.trim().replace(/\s+/g, " ");
    if (cleanReason.length < 2 || cleanReason.length > 400 || hasUnsafeText(cleanReason)) return { ok: false, message: "دلیل تغییر وضعیت مشتری را معتبر وارد کنید." };
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.select({ id: customers.id, status: customers.status }).from(customers).where(and(eq(customers.id, id), isNull(customers.deletedAt))).for("update").limit(1);
      if (!row) return false;
      if (row.status === status) return true;
      await tx.update(customers).set({ status, updatedAt: new Date() }).where(and(eq(customers.id, id), isNull(customers.deletedAt)));
      await writeAudit(tx, {
        actorType: "admin",
        actorId: admin.id,
        action: "customer.status_updated",
        entityType: "customer",
        entityId: id,
        metadata: { from: row.status, to: status, reason: cleanReason },
      });
      return true;
    });
    if (!updated) return { ok: false, message: "مشتری پیدا نشد." };
    return { ok: true };
  } catch (error) {
    if (error instanceof SessionError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function loadInventoryDesk(input: { q: string; categoryId: string; stock: string; page: number; logPage: number }): Promise<InventoryDesk | DeskDenied> {
  try {
    const { db, admin } = await requireAdminAny(["inventory.read", "inventory.write"]);
    const q = input.q.trim().slice(0, 60);
    const categoryId = input.categoryId.trim().slice(0, 80);
    const stock = ["low", "out"].includes(input.stock) ? input.stock : "";
    const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
    const logPage = Number.isInteger(input.logPage) && input.logPage > 0 ? input.logPage : 1;
    const filters = [isNull(productVariants.deletedAt), isNull(products.deletedAt)];
    if (categoryId) filters.push(eq(products.categoryId, categoryId));
    if (q) {
      const pattern = `%${q.replace(/[%_]/g, "").slice(0, 60)}%`;
      filters.push(or(ilike(products.name, pattern), ilike(productVariants.label, pattern), ilike(productVariants.sku, pattern))!);
    }
    if (stock === "low") filters.push(sql`${inventory.onHand} - ${inventory.reserved} <= ${inventory.lowStockThreshold}`);
    if (stock === "out") filters.push(sql`${inventory.onHand} - ${inventory.reserved} <= 0`);
    const where = and(...filters);
    const [totalRow] = await db.select({ n: count() }).from(inventory).innerJoin(productVariants, eq(productVariants.id, inventory.variantId)).innerJoin(products, eq(products.id, productVariants.productId)).where(where);
    const total = num(totalRow?.n);
    const pages = Math.max(1, Math.ceil(total / 20));
    const safePage = Math.min(page, pages);
    const rows = await db
      .select({
        variantId: inventory.variantId,
        productName: products.name,
        label: productVariants.label,
        sku: productVariants.sku,
        unitKind: productVariants.unitKind,
        amount: productVariants.amount,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        onHand: inventory.onHand,
        reserved: inventory.reserved,
        threshold: inventory.lowStockThreshold,
      })
      .from(inventory)
      .innerJoin(productVariants, eq(productVariants.id, inventory.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(where)
      .orderBy(asc(products.name), asc(productVariants.sortOrder), asc(productVariants.id))
      .limit(20)
      .offset((safePage - 1) * 20);

    const logFilters = [];
    if (q) {
      const pattern = `%${q.replace(/[%_]/g, "").slice(0, 60)}%`;
      logFilters.push(or(ilike(products.name, pattern), ilike(productVariants.label, pattern), ilike(productVariants.sku, pattern))!);
    }
    if (categoryId) logFilters.push(eq(products.categoryId, categoryId));
    const logWhere = logFilters.length ? and(...logFilters) : undefined;
    const [logTotalRow] = await db
      .select({ n: count() })
      .from(inventoryLogs)
      .innerJoin(productVariants, eq(productVariants.id, inventoryLogs.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(logWhere);
    const logTotal = num(logTotalRow?.n);
    const logPages = Math.max(1, Math.ceil(logTotal / 20));
    const safeLogPage = Math.min(logPage, logPages);
    const logs = await db
      .select({
        id: inventoryLogs.id,
        sku: productVariants.sku,
        productName: products.name,
        variantLabel: productVariants.label,
        delta: inventoryLogs.delta,
        reason: inventoryLogs.reason,
        note: inventoryLogs.note,
        actorName: adminUsers.fullName,
        orderCode: orders.publicCode,
        onHandBefore: inventoryLogs.onHandBefore,
        onHandAfter: inventoryLogs.onHandAfter,
        reservedBefore: inventoryLogs.reservedBefore,
        reservedAfter: inventoryLogs.reservedAfter,
        createdAt: inventoryLogs.createdAt,
      })
      .from(inventoryLogs)
      .innerJoin(productVariants, eq(productVariants.id, inventoryLogs.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .leftJoin(adminUsers, eq(adminUsers.id, inventoryLogs.actorAdminId))
      .leftJoin(orders, eq(orders.id, inventoryLogs.orderId))
      .where(logWhere)
      .orderBy(desc(inventoryLogs.createdAt), desc(inventoryLogs.id))
      .limit(20)
      .offset((safeLogPage - 1) * 20);
    const categories = await db
      .select({ id: productCategories.id, name: productCategories.name })
      .from(productCategories)
      .where(and(eq(productCategories.isActive, true), isNull(productCategories.deletedAt)))
      .orderBy(asc(productCategories.sortOrder), asc(productCategories.name))
      .limit(100);
    return {
      denied: false,
      rows: rows.map((row) => ({
        variantId: row.variantId,
        productName: row.productName,
        label: row.label,
        sku: row.sku,
        unitLabel: row.unitKind === "volume" && row.amount !== null ? `${row.amount} میلی‌لیتر` : row.unitKind === "weight" && row.amount !== null ? `${row.amount} گرم` : row.label,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        onHand: row.onHand,
        reserved: row.reserved,
        sellable: row.onHand - row.reserved,
        threshold: row.threshold,
        low: row.onHand - row.reserved <= row.threshold,
      })),
      logs: logs.map((row) => ({
        id: row.id,
        sku: row.sku,
        productName: row.productName,
        variantLabel: row.variantLabel,
        delta: row.delta,
        reason: row.reason,
        note: row.note,
        actorLabel: row.actorName ?? "سامانه / بدون شناسه مدیر",
        orderCode: row.orderCode,
        onHandBefore: row.onHandBefore,
        onHandAfter: row.onHandAfter,
        reservedBefore: row.reservedBefore,
        reservedAfter: row.reservedAfter,
        createdAtLabel: fa(row.createdAt),
      })),
      diagnostics: await latestDiagnostics(db),
      canWrite: has(admin, "inventory.write"),
      q,
      categoryId,
      stock,
      page: safePage,
      pages,
      total,
      logPage: safeLogPage,
      logPages,
      logTotal,
      categories,
    };
  } catch (error) {
    return denied(error);
  }
}

export async function loadReports(rangeInput = "30"): Promise<ReportsData | DeskDenied> {
  try {
    const { db } = await requireAdmin("reports.read");
    const range: DashboardRange = rangeInput === "today" || rangeInput === "7" || rangeInput === "all" ? rangeInput : "30";
    const start = rangeStart(range, new Date());
    const stock = await db
      .select({
        onHand: sql<number>`coalesce(sum(${inventory.onHand}), 0)`,
        reserved: sql<number>`coalesce(sum(${inventory.reserved}), 0)`,
      })
      .from(inventory);
    const lowRows = await db
      .select({
        variantId: inventory.variantId,
        productName: products.name,
        label: productVariants.label,
        sku: productVariants.sku,
        unitKind: productVariants.unitKind,
        amount: productVariants.amount,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        onHand: inventory.onHand,
        reserved: inventory.reserved,
        threshold: inventory.lowStockThreshold,
      })
      .from(inventory)
      .innerJoin(productVariants, eq(productVariants.id, inventory.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
      .where(sql`${inventory.onHand} - ${inventory.reserved} <= ${inventory.lowStockThreshold}`)
      .orderBy(asc(products.name))
      .limit(30);
    const grouped = await db.select({ status: orders.status, n: count() }).from(orders)
      .where(start ? gte(orders.createdAt, start) : undefined).groupBy(orders.status);
    const customerWhere = start ? and(isNull(customers.deletedAt), gte(customers.createdAt, start)) : isNull(customers.deletedAt);
    const [registered] = await db.select({ n: count() }).from(customers).where(customerWhere);
    const [allCustomers] = await db.select({ n: count() }).from(customers).where(isNull(customers.deletedAt));
    const genderRows = await db.select({ value: customers.gender, n: count() }).from(customers).where(isNull(customers.deletedAt)).groupBy(customers.gender);
    const ageRows = await db.select({ value: customers.ageGroup, n: count() }).from(customers).where(isNull(customers.deletedAt)).groupBy(customers.ageGroup);
    const couponRows = await db.select().from(coupons).orderBy(desc(coupons.usedCount)).limit(20);
    const shipping = await db
      .select({ title: orders.shippingTitle, n: count() })
      .from(orders)
      .where(start ? gte(orders.createdAt, start) : undefined)
      .groupBy(orders.shippingTitle)
      .orderBy(desc(count()));
    const onHand = num(stock[0]?.onHand);
    const reserved = num(stock[0]?.reserved);
    return {
      denied: false,
      range,
      inventory: [
        { label: "موجودی فیزیکی", value: String(onHand) },
        { label: "رزرو پرداخت‌نشده", value: String(reserved) },
        { label: "قابل فروش", value: String(onHand - reserved) },
      ],
      lowStock: lowRows.map((row) => ({
        variantId: row.variantId,
        productName: row.productName,
        label: row.label,
        sku: row.sku,
        unitLabel: `${num(row.amount)} ${row.unitKind}`,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        onHand: row.onHand,
        reserved: row.reserved,
        sellable: row.onHand - row.reserved,
        threshold: row.threshold,
        low: true,
      })),
      orderStatus: grouped.map((row) => ({ label: orderStatusLabel(row.status), value: String(num(row.n)) })),
      registrations: [
        { label: "مشتری فعال در پرونده", value: String(num(allCustomers?.n)) },
        { label: range === "all" ? "ثبت‌نام کل" : "ثبت‌نام در بازه انتخاب‌شده", value: String(num(registered?.n)) },
      ],
      demographics: {
        gender: demographicDistribution(genderRows.filter((row): row is { value: string; n: number } => row.value !== null).map((row) => ({ value: row.value, count: num(row.n) })), num(allCustomers?.n), "gender"),
        ageGroup: demographicDistribution(ageRows.filter((row): row is { value: string; n: number } => row.value !== null).map((row) => ({ value: row.value, count: num(row.n) })), num(allCustomers?.n), "ageGroup"),
      },
      coupons: couponRows.map((row) => ({
        label: row.code,
        value: row.usageLimit === null ? `${row.usedCount} استفاده` : `${row.usedCount} از ${row.usageLimit}`,
      })),
      shipping: shipping.map((row) => ({ label: row.title || "بدون عنوان", value: String(num(row.n)) })),
      revenueNote: await ledgerNote(db, start),
    };
  } catch (error) {
    return denied(error);
  }
}

export async function loadStaff(): Promise<StaffDesk | DeskDenied> {
  try {
    const { db, admin } = await requireAdminAny(["admins.read", "admins.write"]);
    const users = await db
      .select({
        id: adminUsers.id,
        fullName: adminUsers.fullName,
        email: adminUsers.email,
        mobile: adminUsers.mobile,
        status: adminUsers.status,
      })
      .from(adminUsers)
      .where(isNull(adminUsers.deletedAt))
      .orderBy(asc(adminUsers.fullName));
    const links = await db
      .select({ adminUserId: adminUserRoles.adminUserId, key: adminRoles.key })
      .from(adminUserRoles)
      .innerJoin(adminRoles, eq(adminRoles.id, adminUserRoles.roleId));
    const roles = await db.select({ key: adminRoles.key, name: adminRoles.name }).from(adminRoles).orderBy(asc(adminRoles.name));
    const byUser = new Map<string, string[]>();
    for (const link of links) {
      const list = byUser.get(link.adminUserId) ?? [];
      list.push(link.key);
      byUser.set(link.adminUserId, list);
    }
    return {
      denied: false,
      admins: users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobileMasked: user.mobile ? maskMobile(user.mobile) : null,
        status: user.status,
        statusLabel: user.status === "active" ? "فعال" : user.status === "disabled" ? "غیرفعال" : "دعوت‌شده",
        roles: byUser.get(user.id) ?? [],
        self: user.id === admin.id,
      })),
      roleChoices: roles,
      canWrite: has(admin, "admins.write"),
    };
  } catch (error) {
    return denied(error);
  }
}

export async function revokeAdminSessions(userId: string): Promise<{ ok: true; revoked: number } | { ok: false; message: string }> {
  try {
    const { db, admin } = await requireAdmin("admins.write");
    if (!/^[A-Za-z0-9_-]{4,80}$/.test(userId)) return { ok: false, message: "شناسه مدیر معتبر نیست." };
    if (userId === admin.id) return { ok: false, message: "برای حفظ دسترسی، نشست حساب فعلی از این بخش باطل نمی‌شود." };
    return await db.transaction(async (tx) => {
      const [user] = await tx.select({ id: adminUsers.id }).from(adminUsers)
        .where(and(eq(adminUsers.id, userId), isNull(adminUsers.deletedAt))).for("update").limit(1);
      if (!user) return { ok: false as const, message: "مدیر پیدا نشد." };
      const revoked = await tx.update(adminSessions).set({ revokedAt: new Date() })
        .where(and(eq(adminSessions.adminUserId, userId), isNull(adminSessions.revokedAt)))
        .returning({ id: adminSessions.id });
      await writeAudit(tx, {
        actorType: "admin", actorId: admin.id, action: "admin.sessions_revoked",
        entityType: "admin_user", entityId: userId, metadata: { revokedCount: revoked.length },
      });
      return { ok: true as const, revoked: revoked.length };
    });
  } catch (error) {
    if (error instanceof SessionError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function setAdminAccess(input: {
  id: string;
  status: string;
  roles: string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { db, admin } = await requireAdmin("admins.write");
    return applyStaffChange(db, { actorId: admin.id, userId: input.id, status: input.status, roleKeys: input.roles });
  } catch (error) {
    if (error instanceof SessionError) return { ok: false, message: error.message };
    throw error;
  }
}

async function latestOrders(db: AppDatabase, limit: number): Promise<OrderSummary[]> {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
  return withCounts(db, rows);
}

async function withCounts(
  db: AppDatabase,
  rows: Array<{ id: string; publicCode: string; status: string; paymentStatus: string; totalIrr: number; mobile: string; createdAt: Date | string }>,
): Promise<OrderSummary[]> {
  if (rows.length === 0) return [];
  const counts = await db
    .select({ orderId: orderItems.orderId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((row) => row.id)));
  const totals = new Map<string, number>();
  for (const row of counts) totals.set(row.orderId, (totals.get(row.orderId) ?? 0) + row.quantity);
  return rows.map((row) => ({
    publicCode: row.publicCode,
    statusLabel: orderStatusLabel(row.status),
    paymentStatusLabel: paymentStatusLabel(row.paymentStatus),
    totalIrr: row.totalIrr,
    itemCount: totals.get(row.id) ?? 0,
    createdAtLabel: fa(row.createdAt),
    mobileMasked: maskMobile(row.mobile),
  }));
}

async function latestAudits(db: AppDatabase) {
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12);
  return rows.map((row) => ({
    id: row.id,
    label: ACTION_LABELS[row.action] ?? "رویداد",
    actorLabel: ACTOR_LABELS[row.actorType] ?? "ناشناس",
    detail: auditDetail(row.metadata),
    createdAtLabel: fa(row.createdAt),
  }));
}

function auditDetail(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  if (typeof metadata.identifier === "string") return metadata.identifier;
  if (typeof metadata.label === "string") return metadata.label;
  if (typeof metadata.publicCode === "string") return metadata.publicCode;
  return "";
}

async function latestDiagnostics(db: AppDatabase) {
  const rows = await db.select().from(opsDiagnostics).orderBy(desc(opsDiagnostics.createdAt)).limit(8);
  return rows.map((row) => ({ id: row.id, message: row.message, createdAtLabel: fa(row.createdAt) }));
}

function customerStatusLabel(status: string): string {
  if (status === "active") return "فعال";
  if (status === "blocked") return "مسدود";
  return status;
}
