import { todayInTehran } from "../../lib/order-flow";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { moveOrderForAdmin, refundForAdmin, returnForCustomer, returnQueue, reviewReturnForAdmin, settlePaidCancelForAdmin, shipmentForAdmin } from "./fulfillment";
import { manualNextStatuses } from "@/lib/order-flow";
import { requireAdmin } from "../auth/guard";
import { writeAudit } from "../auth/audit";
import { desc, eq } from "drizzle-orm";
import { orders, orderItems, orderFulfillmentWork, settings, shippingLogs } from "../db/schema";

export const moveOrderFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ publicCode: z.string().min(4).max(32), next: z.string().min(3).max(40), reason: z.string().trim().min(2).max(400) }).parse(input))
  .handler(async ({ data }) => moveOrderForAdmin(data.publicCode, data.next, data.reason));

export const shipmentFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        publicCode: z.string().min(4).max(32),
        carrier: z.string().max(40),
        trackingCode: z.string().max(60).default(""),
        note: z.string().trim().min(2).max(300),
        handedOffAt: z.string().max(40).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data }) => shipmentForAdmin(data.publicCode, data));

export const requestReturnFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ publicCode: z.string().min(4).max(32), reason: z.string().max(400) }).parse(input))
  .handler(async ({ data }) => returnForCustomer(data.publicCode, data.reason));

export const reviewReturnFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(4).max(80),
        status: z.enum(["reviewing", "approved", "rejected", "received"]),
        note: z.string().trim().min(2).max(400),
      })
      .parse(input),
  )
  .handler(async ({ data }) => reviewReturnForAdmin(data.id, data.status, data.note));

export const settleCancelFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ publicCode: z.string().min(4).max(32), reason: z.string().trim().min(2).max(400) }).parse(input))
  .handler(async ({ data }) => settlePaidCancelForAdmin(data.publicCode, data.reason));

export const recordRefundFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(4).max(80),
        kind: z.enum(["full", "partial"]),
        requestedIrr: z.number().int().min(0).max(5_000_000_000).default(0),
        reason: z.string().trim().min(2).max(400),
      })
      .parse(input),
  )
  .handler(async ({ data }) => refundForAdmin(data.id, data.kind, data.requestedIrr, data.reason));

export const returnQueueFn = createServerFn({ method: "GET" }).handler(async () => returnQueue());

export const nextStatusOptions = manualNextStatuses;


const packingWorkSchema = z.object({
  publicCode: z.string().min(4).max(32),
  pickedItems: z.array(z.object({ orderItemId: z.string().min(1).max(100), pickedQuantity: z.number().int().min(0).max(1000), lot: z.string().trim().max(80).optional(), expiresOn: z.union([z.iso.date(), z.literal("")]).optional() })).max(100),
  pickerName: z.string().trim().max(80),
  checkerName: z.string().trim().max(80),
  packageCount: z.number().int().min(1).max(100),
  weightGrams: z.number().int().min(0).max(100000).nullable(),
  discrepancyNote: z.string().trim().max(1000),
});

export const getOrderPackingWorkFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ publicCode: z.string().min(4).max(32) }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin("orders.read");
    const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.publicCode, data.publicCode)).limit(1);
    if (!order) return null;
    const [record] = await db.select().from(orderFulfillmentWork).where(eq(orderFulfillmentWork.orderId, order.id)).limit(1);
    return record ? {
      pickedItems: record.pickedItems, pickerName: record.pickerName, checkerName: record.checkerName,
      packageCount: record.packageCount, weightGrams: record.weightGrams,
      discrepancyNote: record.discrepancyNote, updatedAt: record.updatedAt.toISOString(),
    } : null;
  });

export const saveOrderPackingWorkFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => packingWorkSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, admin } = await requireAdmin("orders.write");
    return db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.publicCode, data.publicCode)).for("update").limit(1);
      if (!order) return { ok: false as const, message: "سفارش پیدا نشد." };
      const lines = await tx.select({ id: orderItems.id, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, order.id));
      const allowed = new Map(lines.map((line) => [line.id, line.quantity]));
      const seen = new Set<string>();
      for (const item of data.pickedItems) {
        const requested = allowed.get(item.orderItemId);
        if (requested === undefined || seen.has(item.orderItemId) || item.pickedQuantity > requested) {
          return { ok: false as const, message: "مقادیر برداشت با اقلام سفارش مطابقت ندارد." };
        }
        if (item.pickedQuantity > 0 && item.expiresOn && item.expiresOn < todayInTehran()) {
          return { ok: false as const, message: "برداشت از سری منقضی مجاز نیست." };
        }
        seen.add(item.orderItemId);
      }
      const values = {
        pickedItems: data.pickedItems, pickerName: data.pickerName, checkerName: data.checkerName,
        packageCount: data.packageCount, weightGrams: data.weightGrams, discrepancyNote: data.discrepancyNote,
        updatedBy: admin.id, updatedAt: new Date(),
      };
      await tx.insert(orderFulfillmentWork).values({ id: "ofw-" + crypto.randomUUID(), orderId: order.id, ...values })
        .onConflictDoUpdate({ target: orderFulfillmentWork.orderId, set: values });
      await writeAudit(tx, {
        actorType: "admin", actorId: admin.id, action: "order.packing_work.save",
        entityType: "order", entityId: order.id,
        metadata: { publicCode: order.publicCode, lineCount: data.pickedItems.length, packageCount: data.packageCount, weightGrams: data.weightGrams },
      });
      return { ok: true as const, message: "اطلاعات بسته‌بندی ذخیره شد." };
    });
  });


const senderProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(40),
  province: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(500),
  postalCode: z.string().trim().max(20),
});

export const getShippingSenderProfileFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await requireAdmin("orders.read");
    const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "shipping.sender_profile")).limit(1);
    const value = row?.value;
    if (!value || typeof value !== "object") return { name: "", phone: "", province: "", city: "", address: "", postalCode: "" };
    const data = value as Record<string, unknown>;
    return {
      name: typeof data.name === "string" ? data.name : "",
      phone: typeof data.phone === "string" ? data.phone : "",
      province: typeof data.province === "string" ? data.province : "",
      city: typeof data.city === "string" ? data.city : "",
      address: typeof data.address === "string" ? data.address : "",
      postalCode: typeof data.postalCode === "string" ? data.postalCode : "",
    };
  });

export const saveShippingSenderProfileFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => senderProfileSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, admin } = await requireAdmin("orders.write");
    await db.insert(settings).values({ key: "shipping.sender_profile", value: data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value: data, updatedAt: new Date() } });
    await writeAudit(db, {
      actorType: "admin", actorId: admin.id, action: "shipping.sender_profile.update",
      entityType: "setting", entityId: "shipping.sender_profile",
      metadata: { city: data.city, province: data.province, postalCode: data.postalCode, phonePresent: Boolean(data.phone) },
    });
    return { ok: true as const, message: "مشخصات فرستنده ذخیره شد." };
  });


export const getOrderShippingLabelsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ publicCode: z.string().min(4).max(32) }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await requireAdmin("orders.read");
    const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.publicCode, data.publicCode)).limit(1);
    if (!order) return [];
    const rows = await db.select({
      id: shippingLogs.id, carrier: shippingLogs.carrier, trackingCode: shippingLogs.trackingCode,
      status: shippingLogs.status, handedOffAt: shippingLogs.handedOffAt, note: shippingLogs.note,
      senderSnapshot: shippingLogs.senderSnapshot, recipientSnapshot: shippingLogs.recipientSnapshot,
      createdAt: shippingLogs.createdAt,
    }).from(shippingLogs).where(eq(shippingLogs.orderId, order.id)).orderBy(desc(shippingLogs.createdAt)).limit(20);
    return rows.map((row) => ({
      ...row,
      handedOffAt: row.handedOffAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });
