import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { initiatePayPingPayment, retryPayPingSettlement, retryPayPingVerification, reviewPayPingUnknownAttempt, retryPayPingVerificationForAdmin, retryPayPingSettlementForAdmin } from "./payping-lifecycle.ts";

export const initiatePayPingPaymentFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ orderId: z.string().min(1).max(80), idempotencyKey: z.string().uuid() }).parse(input))
  .handler(({ data }) => initiatePayPingPayment(data.orderId, data.idempotencyKey));

export const retryPayPingSettlementFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ attemptId: z.string().min(1).max(80) }).parse(input))
  .handler(({ data }) => retryPayPingSettlement(data.attemptId));

export const retryPayPingVerificationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ attemptId: z.string().min(1).max(80) }).parse(input))
  .handler(({ data }) => retryPayPingVerification(data.attemptId));

export const reviewPayPingUnknownAttemptFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ attemptId: z.string().min(1).max(80), decision: z.literal("manual_review"), note: z.string().min(10).max(500) }).parse(input))
  .handler(({ data }) => reviewPayPingUnknownAttempt(data.attemptId, data.decision, data.note));

export const retryPayPingVerificationForAdminFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ attemptId: z.string().min(1).max(80) }).parse(input))
  .handler(({ data }) => retryPayPingVerificationForAdmin(data.attemptId));

export const retryPayPingSettlementForAdminFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ attemptId: z.string().min(1).max(80) }).parse(input))
  .handler(({ data }) => retryPayPingSettlementForAdmin(data.attemptId));
