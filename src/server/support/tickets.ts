import { asc, desc, eq } from "drizzle-orm";
import { hasUnsafeText } from "@/lib/text-safety";
import { writeAudit } from "../auth/audit";
import { requireAdminAny, requireCustomer, SessionError } from "../auth/guard";
import type { AppDatabase } from "../db/client";
import { customers, supportMessages, supportTickets } from "../db/schema";
import { recordNotice } from "../notify/events";

export const SUPPORT_CATEGORIES = ["order", "shipping", "product", "payment", "other"] as const;

const CATEGORY_LABEL: Record<string, string> = {
  order: "سفارش",
  shipping: "ارسال",
  product: "محصول",
  payment: "پرداخت",
  other: "سایر",
};

function clean(value: string, min: number, max: number): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max || hasUnsafeText(text)) return null;
  return text;
}

function code() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SP-${day}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function openTicket(db: AppDatabase, customerId: string, category: string, subject: string, body: string) {
  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(category)) return { ok: false as const, message: "دسته درخواست معتبر نیست." };
  const title = clean(subject, 3, 80);
  const text = clean(body, 8, 2000);
  if (!title || !text) return { ok: false as const, message: "موضوع و متن درخواست را کامل بنویسید." };
  const id = `tck-${crypto.randomUUID()}`;
  const publicCode = code();
  await db.transaction(async (tx) => {
    await tx.insert(supportTickets).values({ id, publicCode, customerId, category, subject: title, status: "open" });
    await tx.insert(supportMessages).values({
      id: `tmsg-${crypto.randomUUID()}`,
      ticketId: id,
      authorType: "customer",
      authorId: customerId,
      body: text,
    });
    const [customer] = await tx.select({ mobile: customers.mobile }).from(customers).where(eq(customers.id, customerId)).limit(1);
    await recordNotice(tx, {
      eventKey: "support.status",
      detail: `${publicCode} باز شد`,
      recipient: customer?.mobile || customerId,
      customerId,
    });
    await writeAudit(tx, {
      actorType: "customer",
      actorId: customerId,
      action: "support.opened",
      entityType: "support_ticket",
      entityId: id,
      metadata: { category },
    });
  });
  return { ok: true as const, publicCode };
}

export async function customerTickets(db: AppDatabase, customerId: string) {
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.customerId, customerId)).orderBy(desc(supportTickets.updatedAt));
  return rows.map((row) => ({
    id: row.id,
    publicCode: row.publicCode,
    category: CATEGORY_LABEL[row.category] ?? row.category,
    subject: row.subject,
    status: row.status,
  }));
}

export async function ticketThread(db: AppDatabase, ticketId: string, customerId: string | null) {
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) return null;
  if (customerId && ticket.customerId !== customerId) return null;
  const messages = await db.select().from(supportMessages).where(eq(supportMessages.ticketId, ticket.id)).orderBy(asc(supportMessages.createdAt));
  return {
    id: ticket.id,
    publicCode: ticket.publicCode,
    subject: ticket.subject,
    status: ticket.status,
    category: CATEGORY_LABEL[ticket.category] ?? ticket.category,
    messages: messages.map((message) => ({
      id: message.id,
      authorType: message.authorType,
      body: message.body,
      createdAt: new Date(message.createdAt).toISOString(),
    })),
  };
}

export async function replyTicket(db: AppDatabase, ticketId: string, authorType: "customer" | "admin", authorId: string, body: string, nextStatus?: string) {
  const text = clean(body, 2, 2000);
  if (!text) return { ok: false as const, message: "متن پاسخ معتبر نیست." };
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) return { ok: false as const, message: "درخواست پیدا نشد." };
  if (authorType === "customer" && ticket.customerId !== authorId) return { ok: false as const, message: "این درخواست برای حساب شما نیست." };
  if (ticket.status === "closed" && authorType === "customer") return { ok: false as const, message: "این درخواست بسته شده است." };
  const status = nextStatus && ["open", "reviewing", "closed"].includes(nextStatus) ? nextStatus : authorType === "admin" ? "reviewing" : ticket.status;
  await db.transaction(async (tx) => {
    await tx.insert(supportMessages).values({
      id: `tmsg-${crypto.randomUUID()}`,
      ticketId,
      authorType,
      authorId,
      body: text,
    });
    await tx.update(supportTickets).set({ status, updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    await recordNotice(tx, {
      eventKey: "support.status",
      detail: `${ticket.publicCode} ${status}`,
      recipient: ticket.customerId,
      customerId: ticket.customerId,
    });
  });
  return { ok: true as const };
}

export async function openTicketForSession(category: string, subject: string, body: string) {
  try {
    const { db, customer } = await requireCustomer();
    return await openTicket(db, customer.id, category, subject, body);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "ثبت درخواست انجام نشد." };
  }
}

export async function myTickets() {
  try {
    const { db, customer } = await requireCustomer();
    return { ok: true as const, tickets: await customerTickets(db, customer.id) };
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message, tickets: [] };
    return { ok: false as const, message: "فهرست درخواست‌ها خوانده نشد.", tickets: [] };
  }
}

export async function myThread(id: string) {
  try {
    const { db, customer } = await requireCustomer();
    return await ticketThread(db, id, customer.id);
  } catch {
    return null;
  }
}

export async function replyAsCustomer(id: string, body: string) {
  try {
    const { db, customer } = await requireCustomer();
    return await replyTicket(db, id, "customer", customer.id, body);
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "ارسال پاسخ انجام نشد." };
  }
}

export async function adminThread(id: string) {
  try {
    const { db } = await requireAdminAny(["customers.read", "support.write"]);
    const thread = await ticketThread(db, id, null);
    if (!thread) return { ok: false as const, message: "درخواست پیدا نشد.", thread: null };
    return { ok: true as const, thread };
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message, thread: null };
    return { ok: false as const, message: "گفتگو خوانده نشد.", thread: null };
  }
}

export async function adminTickets() {
  try {
    const { db } = await requireAdminAny(["customers.read", "support.write"]);
    const rows = await db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt)).limit(80);
    return {
      ok: true as const,
      tickets: rows.map((row) => ({
        id: row.id,
        publicCode: row.publicCode,
        subject: row.subject,
        status: row.status,
        category: CATEGORY_LABEL[row.category] ?? row.category,
      })),
    };
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message, tickets: [] };
    return { ok: false as const, message: "فهرست پشتیبانی خوانده نشد.", tickets: [] };
  }
}

export async function adminReply(id: string, body: string, status: string) {
  try {
    const { db, admin } = await requireAdminAny(["support.write"]);
    const result = await replyTicket(db, id, "admin", admin.id, body, status);
    if (result.ok) {
      await writeAudit(db, {
        actorType: "admin",
        actorId: admin.id,
        action: "support.replied",
        entityType: "support_ticket",
        entityId: id,
        metadata: { status },
      });
    }
    return result;
  } catch (error) {
    if (error instanceof SessionError) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "پاسخ پشتیبانی انجام نشد." };
  }
}

