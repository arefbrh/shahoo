import { deliveryAreaKey, deliveryAreas } from "./delivery-area";
import { IRAN_PROVINCES } from "../../lib/iran-provinces";
import { and, asc, eq } from "drizzle-orm";
import { irrToToman } from "@/lib/money";
import type { OfferDesk, OfferResult } from "@/lib/offer-types";
import { dayKey, parseCouponDraft, parseShippingDraft, type CouponDraft, type ShippingDraft } from "@/lib/offer-rules";
import { writeAudit } from "../auth/audit";
import { SessionError, requireAdmin, requireAdminAny } from "../auth/guard";
import { maskMobile } from "../auth/mobile";
import { orderEvents, orders, coupons, shippingMethods, settings } from "../db/schema";
import { recordReservationConflict, releaseHeldStock, asReservationConflict } from "../commerce/release-hold";

export async function loadOfferDesk(): Promise<OfferDesk> {
  const { db } = await requireAdminAny(["settings.read", "settings.write"]);
  const [couponRows, methodRows, areas] = await Promise.all([
    db.select().from(coupons).orderBy(asc(coupons.code)),
    db.select().from(shippingMethods).orderBy(asc(shippingMethods.sortOrder)),
    deliveryAreas(db),
  ]);
  return {
    coupons: couponRows.map((row) => ({
      id: row.id,
      code: row.code,
      description: row.description,
      mode: row.percentOff ? "percent" : "amount",
      percent: row.percentOff,
      amountToman: row.amountOffIrr === null ? null : irrToToman(row.amountOffIrr),
      minSubtotalToman: irrToToman(row.minSubtotalIrr),
      usageLimit: row.usageLimit,
      usedCount: row.usedCount,
      startsOn: dayKey(row.startsAt),
      endsOn: dayKey(row.endsAt),
      isActive: row.isActive,
    })),
    methods: methodRows.map((row) => ({
      ...areas.get(row.id),
      id: row.id,
      key: row.key,
      title: row.title,
      description: row.description,
      priceToman: irrToToman(row.priceIrr),
      freeOverToman: row.freeOverIrr === null ? null : irrToToman(row.freeOverIrr),
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    })),
  };
}

export async function saveCoupon(input: CouponDraft & { id?: string }): Promise<OfferResult> {
  try {
    const { db, admin } = await requireAdmin("settings.write");
    const parsed = parseCouponDraft(input);
    if (!parsed.ok) return parsed;
    const data = parsed.value;
    const [owner] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, data.code)).limit(1);
    if (owner && owner.id !== input.id) return { ok: false, message: "این کد قبلاً ثبت شده است." };
    const id = input.id || `coupon-${crypto.randomUUID()}`;
    const values = {
      code: data.code,
      description: data.description,
      percentOff: data.percentOff,
      amountOffIrr: data.amountOffIrr,
      minSubtotalIrr: data.minSubtotalIrr,
      usageLimit: data.usageLimit,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      isActive: data.isActive,
      updatedAt: new Date(),
    };
    if (input.id) {
      const [existing] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.id, input.id)).limit(1);
      if (!existing) return { ok: false, message: "کد تخفیف پیدا نشد." };
    }
    await db.transaction(async (tx) => {
      if (input.id) await tx.update(coupons).set(values).where(eq(coupons.id, input.id));
      else await tx.insert(coupons).values({ id, ...values });
      await writeAudit(tx, {
        actorType: "admin",
        actorId: admin.id,
        action: "coupon.saved",
        entityType: "coupon",
        entityId: id,
        metadata: { label: data.code },
      });
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveShipping(input: ShippingDraft & { id?: string }): Promise<OfferResult> {
  try {
    const { db, admin } = await requireAdmin("settings.write");
    return await applyShippingDraft(db, admin.id, input);
  } catch (error) {
    return fail(error);
  }
}

export async function applyShippingDraft(
  db: Awaited<ReturnType<typeof requireAdmin>>["db"],
  actorId: string,
  input: ShippingDraft & { id?: string },
): Promise<OfferResult> {
  if ((input.city && !input.province) || (input.province && !IRAN_PROVINCES.some((name) => name === input.province))) return { ok: false, message: "استان معتبر انتخاب کنید." };
  const parsed = parseShippingDraft(input);
  if (!parsed.ok) return parsed;
  const data = parsed.value;
  const [owner] = await db.select({ id: shippingMethods.id }).from(shippingMethods).where(eq(shippingMethods.key, data.key)).limit(1);
  if (owner && owner.id !== input.id) return { ok: false, message: "این شناسه ارسال قبلاً استفاده شده است." };
  const id = input.id || `ship-${crypto.randomUUID()}`;
  const values = {
    title: data.title,
    description: data.description,
    priceIrr: data.priceIrr,
    freeOverIrr: data.freeOverIrr,
    sortOrder: data.sortOrder,
    isActive: data.isActive,
    provider: "manual" as const,
    updatedAt: new Date(),
  };
  if (input.id) {
    const [existing] = await db.select({ id: shippingMethods.id }).from(shippingMethods).where(eq(shippingMethods.id, input.id)).limit(1);
    if (!existing) return { ok: false, message: "روش ارسال پیدا نشد." };
  }
  await db.transaction(async (tx) => {
    if (input.id) await tx.update(shippingMethods).set(values).where(eq(shippingMethods.id, input.id));
    else await tx.insert(shippingMethods).values({ id, key: data.key, ...values });
    if (input.province !== undefined || input.city !== undefined) {
      const value = { province: input.province ?? "", city: input.city ?? "" };
      await tx.insert(settings).values({ key: deliveryAreaKey(id), value })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    }
    await writeAudit(tx, {
      actorType: "admin",
      actorId,
      action: "shipping.saved",
      entityType: "shipping_method",
      entityId: id,
      metadata: { label: data.title },
    });
  });
  return { ok: true };
}

export async function cancelUnpaidOrder(publicCode: string): Promise<OfferResult> {
  let database: Awaited<ReturnType<typeof requireAdmin>>["db"] | null = null;
  try {
    const { db, admin } = await requireAdmin("orders.write");
    database = db;
    if (!/^SH-\d{8}-[A-Z0-9]{4}$/.test(publicCode)) return { ok: false, message: "شماره سفارش معتبر نیست." };
    const released = await db.transaction(async (tx) => {
      const claimed = await tx
        .update(orders)
        .set({ status: "cancelled", stockState: "released", stockHoldUntil: null, updatedAt: new Date() })
        .where(and(eq(orders.publicCode, publicCode), eq(orders.status, "awaiting_payment")))
        .returning({
          id: orders.id,
          publicCode: orders.publicCode,
          couponId: orders.couponId,
          mobile: orders.mobile,
        });
      const order = claimed[0];
      if (!order) return null;
      await releaseHeldStock(tx, order, "release_cancelled", admin.id);
      await tx.insert(orderEvents).values({
        id: `oev-${crypto.randomUUID()}`,
        orderId: order.id,
        status: "cancelled",
        note: "سفارش پرداخت‌نشده لغو شد. موجودی رزرو آزاد شد. هیچ پرداختی ثبت نشده است.",
        actor: "admin",
      });
      await writeAudit(tx, {
        actorType: "admin",
        actorId: admin.id,
        action: "order.cancelled",
        entityType: "order",
        entityId: order.id,
        metadata: { publicCode: order.publicCode, label: maskMobile(order.mobile) },
      });
      return order;
    });
    if (!released) return { ok: false, message: "فقط سفارش در انتظار پرداخت لغو می‌شود. پرداخت‌شده‌ای وجود ندارد." };
    return { ok: true };
  } catch (error) {
    const conflict = asReservationConflict(error);
    if (conflict && database) {
      await recordReservationConflict(database, conflict);
      return { ok: false, message: "رزرو موجودی با این سفارش هم‌خوان نیست. وضعیت سفارش عوض نشد." };
    }
    return fail(error);
  }
}

function fail(error: unknown): OfferResult {
  if (error instanceof SessionError) return { ok: false, message: error.message };
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && current && "code" in current && (current as { code?: string }).code === "23505") {
      return { ok: false, message: "این شناسه تکراری است." };
    }
    if (current instanceof Error) {
      if (/duplicate|unique|23505/i.test(current.message)) return { ok: false, message: "این شناسه تکراری است." };
      current = current.cause;
    } else break;
  }
  throw error;
}
