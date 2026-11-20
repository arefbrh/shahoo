import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { OfferDesk, OfferResult } from "@/lib/offer-types";
import { cancelUnpaidOrder, loadOfferDesk, saveCoupon, saveShipping } from "./admin";

const couponSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  code: z.string().min(3).max(40),
  description: z.string().max(200).default(""),
  mode: z.enum(["percent", "amount"]),
  percent: z.number().int().nullable(),
  amountToman: z.number().int().nullable(),
  minSubtotalToman: z.number().int(),
  usageLimit: z.number().int().nullable(),
  startsOn: z.string().max(10).default(""),
  endsOn: z.string().max(10).default(""),
  isActive: z.boolean(),
});

const shippingSchema = z.object({
  id: z.string().min(2).max(80).optional(),
  key: z.string().min(2).max(40),
  title: z.string().min(2).max(60),
  description: z.string().max(200).default(""),
  priceToman: z.number().int(),
  freeOverToman: z.number().int().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

export const getOfferDesk = createServerFn({ method: "GET" }).handler(async (): Promise<OfferDesk> => loadOfferDesk());

export const saveCouponFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => couponSchema.parse(input))
  .handler(async ({ data }): Promise<OfferResult> => saveCoupon(data));

export const saveShippingFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => shippingSchema.parse(input))
  .handler(async ({ data }): Promise<OfferResult> => saveShipping(data));

export const cancelUnpaidOrderFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ publicCode: z.string().min(8).max(40) }).parse(input))
  .handler(async ({ data }): Promise<OfferResult> => cancelUnpaidOrder(data.publicCode));
