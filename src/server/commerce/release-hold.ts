import { and, eq, sql } from "drizzle-orm";
import { couponRestoreId, releaseDecision } from "@/lib/stock-release";
import { writeAudit } from "../auth/audit";
import type { AppDatabase } from "../db/client";
import { coupons, inventory, inventoryLogs, opsDiagnostics, orderEvents, orderItems } from "../db/schema";

type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export class ReservationConflict extends Error {
  readonly detail: {
    orderId: string;
    publicCode: string;
    variantId: string | null;
    reserved: number;
    quantity: number;
  };

  constructor(detail: ReservationConflict["detail"]) {
    super("reservation shortfall");
    this.name = "ReservationConflict";
    this.detail = detail;
  }
}

export async function releaseHeldStock(
  tx: Tx,
  order: { id: string; publicCode: string; couponId: string | null },
  reason: "release_expired" | "release_cancelled",
  actorAdminId: string | null,
): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const item of items) {
    if (!item.variantId) continue;
    const [stock] = await tx
      .select({ onHand: inventory.onHand, reserved: inventory.reserved })
      .from(inventory)
      .where(eq(inventory.variantId, item.variantId))
      .limit(1);
    const decision = releaseDecision(stock?.reserved ?? 0, item.quantity);
    if (!decision.ok) {
      throw new ReservationConflict({
        orderId: order.id,
        publicCode: order.publicCode,
        variantId: item.variantId,
        reserved: stock?.reserved ?? 0,
        quantity: item.quantity,
      });
    }
    const updated = await tx
      .update(inventory)
      .set({ reserved: sql`${inventory.reserved} - ${item.quantity}`, updatedAt: new Date() })
      .where(and(eq(inventory.variantId, item.variantId), sql`${inventory.reserved} >= ${item.quantity}`))
      .returning({ variantId: inventory.variantId, onHand: inventory.onHand, reserved: inventory.reserved });
    if (updated.length === 0) {
      throw new ReservationConflict({
        orderId: order.id,
        publicCode: order.publicCode,
        variantId: item.variantId,
        reserved: stock?.reserved ?? 0,
        quantity: item.quantity,
      });
    }
    await tx.insert(inventoryLogs).values({
      id: `ilog-${crypto.randomUUID()}`,
      variantId: item.variantId,
      delta: -item.quantity,
      reason,
      note: order.publicCode,
      actorAdminId,
      onHandBefore: stock?.onHand ?? updated[0]!.onHand,
      onHandAfter: updated[0]!.onHand,
      reservedBefore: stock?.reserved ?? updated[0]!.reserved + item.quantity,
      reservedAfter: updated[0]!.reserved,
      orderId: order.id,
    });
  }

  const couponId = couponRestoreId(order.couponId);
  if (!couponId) return;
  const restored = await tx
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} - 1`, updatedAt: new Date() })
    .where(and(eq(coupons.id, couponId), sql`${coupons.usedCount} > 0`))
    .returning({ id: coupons.id });
  if (restored.length === 0) {
    await tx.insert(orderEvents).values({
      id: `oev-${crypto.randomUUID()}`,
      orderId: order.id,
      status: "note",
      note: "شمارش استفاده کد تخفیف با سفارش هم‌خوان نبود و کم نشد.",
      actor: "system",
    });
  }
}

export function asReservationConflict(error: unknown): ReservationConflict | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current instanceof ReservationConflict) return current;
    if (current instanceof Error) current = current.cause;
    else break;
  }
  return null;
}

export async function recordReservationConflict(db: AppDatabase, error: ReservationConflict): Promise<void> {
  await db.insert(opsDiagnostics).values({
    id: `diag-${crypto.randomUUID()}`,
    kind: "inventory.reservation_mismatch",
    entityType: "order",
    entityId: error.detail.orderId,
    message: "رزرو موجودی برای آزادسازی کافی نبود. وضعیت سفارش تغییر نکرد.",
    metadata: {
      publicCode: error.detail.publicCode,
      variantId: error.detail.variantId,
      reserved: error.detail.reserved,
      quantity: error.detail.quantity,
    },
  });
  await writeAudit(db, {
    actorType: "system",
    action: "inventory.inconsistent",
    entityType: "order",
    entityId: error.detail.orderId,
    metadata: {
      publicCode: error.detail.publicCode,
      variantId: error.detail.variantId,
      reserved: error.detail.reserved,
      quantity: error.detail.quantity,
    },
  });
}
