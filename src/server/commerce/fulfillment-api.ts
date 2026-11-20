import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { moveOrderForAdmin, refundForAdmin, returnForCustomer, returnQueue, reviewReturnForAdmin, settlePaidCancelForAdmin, shipmentForAdmin } from "./fulfillment";
import { manualNextStatuses } from "@/lib/order-flow";

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
