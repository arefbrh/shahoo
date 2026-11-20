import { and, eq, isNotNull, lt, notInArray } from "drizzle-orm";
import { writeAudit } from "../auth/audit";
import { asTime } from "../auth/db";
import type { AppDatabase } from "../db/client";
import { orderEvents, orders } from "../db/schema";
import { recordReservationConflict, releaseHeldStock, asReservationConflict } from "./release-hold";

/** Free stock held by unpaid orders whose 24-hour window has passed. No payment is recorded. */
export async function releaseExpiredHolds(db: AppDatabase): Promise<number> {
  let releasedCount = 0;
  const examinedIds: string[] = [];
  const maxExaminedPerRun = 200;

  // Process bounded batches. Excluding already examined IDs for this invocation
  // prevents one inconsistent reservation from starving every later expired
  // order on each scheduled run.
  while (examinedIds.length < maxExaminedPerRun) {
    const filters = [
      eq(orders.status, "awaiting_payment"),
      eq(orders.paymentStatus, "unpaid"),
      eq(orders.stockState, "held"),
      isNotNull(orders.stockHoldUntil),
      lt(orders.stockHoldUntil, new Date()),
    ];
    if (examinedIds.length) filters.push(notInArray(orders.id, examinedIds));
    const due = await db.select({ id: orders.id }).from(orders).where(and(...filters)).limit(40);
    if (due.length === 0) break;

    for (const row of due) {
      examinedIds.push(row.id);
      try {
        const released = await db.transaction(async (tx) => {
          const claimed = await tx
            .update(orders)
            .set({ status: "expired", stockState: "released", updatedAt: new Date() })
            .where(
              and(
                eq(orders.id, row.id),
                eq(orders.status, "awaiting_payment"),
                eq(orders.paymentStatus, "unpaid"),
                eq(orders.stockState, "held"),
                lt(orders.stockHoldUntil, new Date()),
              ),
            )
            .returning({
              id: orders.id,
              publicCode: orders.publicCode,
              couponId: orders.couponId,
              customerId: orders.customerId,
            });
          const order = claimed[0];
          if (!order) return null;
          await releaseHeldStock(tx, order, "release_expired", null);
          await tx.insert(orderEvents).values({
            id: `oev-${crypto.randomUUID()}`,
            orderId: order.id,
            status: "expired",
            note: "مهلت ۲۴ساعته نگهداری موجودی تمام شد. پرداختی ثبت نشده است.",
            actor: "system",
          });
          await writeAudit(tx, {
            actorType: "system",
            actorId: order.customerId,
            action: "order.hold_released",
            entityType: "order",
            entityId: order.id,
            metadata: { publicCode: order.publicCode },
          });
          return order;
        });
        if (released) releasedCount += 1;
      } catch (error) {
        const conflict = asReservationConflict(error);
        if (conflict) {
          await recordReservationConflict(db, conflict);
          continue;
        }
        throw error;
      }
    }
  }
  return releasedCount;
}

export function timeValue(value: Date | string | number | null): number | null {
  if (value === null) return null;
  const time = asTime(value);
  return time || null;
}
