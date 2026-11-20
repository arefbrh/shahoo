import type { AppDatabase } from "../db/client";
import { notifications } from "../db/schema";

type Tx = Pick<AppDatabase, "insert">;

const TEXT: Record<string, (detail: string) => string> = {
  "order.placed": (detail) => `سفارش ${detail} ثبت شد و هنوز پرداخت نشده است.`,
  "order.status": (detail) => `وضعیت سفارش تغییر کرد: ${detail}`,
  "order.shipment": (detail) => `اطلاعات ارسال ثبت شد: ${detail}`,
  "order.return": (detail) => `درخواست مرجوعی به‌روز شد: ${detail}`,
  "support.status": (detail) => `درخواست پشتیبانی به‌روز شد: ${detail}`,
};

export async function recordNotice(
  db: Tx,
  input: {
    eventKey: string;
    detail: string;
    recipient: string;
    customerId?: string | null;
    orderId?: string | null;
  },
): Promise<void> {
  const render = TEXT[input.eventKey] ?? ((detail: string) => detail);
  await db.insert(notifications).values({
    id: `ntf-${crypto.randomUUID()}`,
    channel: "internal",
    templateKey: input.eventKey,
    recipient: input.recipient,
    body: render(input.detail),
    status: "stored",
    customerId: input.customerId ?? null,
    orderId: input.orderId ?? null,
    eventKey: input.eventKey,
  });
}
