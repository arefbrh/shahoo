import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminReply, adminThread, adminTickets, myThread, myTickets, openTicketForSession, replyAsCustomer } from "./tickets";

const category = z.enum(["order", "shipping", "product", "payment", "other"]);

export const myTicketsFn = createServerFn({ method: "GET" }).handler(async () => myTickets());

export const myThreadFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => myThread(data.id));

export const openTicketFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ category, subject: z.string().max(80), body: z.string().max(2000) }).parse(input))
  .handler(async ({ data }) => openTicketForSession(data.category, data.subject, data.body));

export const replyTicketFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(4).max(80), body: z.string().max(2000) }).parse(input))
  .handler(async ({ data }) => replyAsCustomer(data.id, data.body));

export const adminTicketsFn = createServerFn({ method: "GET" }).handler(async () => adminTickets());

export const adminThreadFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => adminThread(data.id));

export const adminReplyFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().min(4).max(80),
        body: z.string().max(2000),
        status: z.enum(["open", "reviewing", "closed"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => adminReply(data.id, data.body, data.status));
