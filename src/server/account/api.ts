import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  customerAddressesForSession,
  removeAddressForSession,
  saveAddressForSession,
  setDefaultAddressForSession,
} from "./addresses";
import { mergeWishlistForSession, toggleWishlistForSession, wishlistForSession } from "./wishlist";

const addressSchema = z.object({
  id: z.string().max(80).nullable().optional(),
  label: z.string().max(40).default(""),
  recipientName: z.string().max(80),
  recipientMobile: z.string().max(20),
  province: z.string().max(40),
  city: z.string().max(40),
  addressLine: z.string().max(300),
  postalCode: z.string().max(20),
  plaque: z.string().max(20).default(""),
  unit: z.string().max(20).default(""),
});

export const listAddressesFn = createServerFn({ method: "GET" }).handler(async () => customerAddressesForSession());

export const saveAddressFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => addressSchema.parse(input))
  .handler(async ({ data }) => saveAddressForSession(data));

export const removeAddressFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => removeAddressForSession(data.id));

export const setDefaultAddressFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => setDefaultAddressForSession(data.id));

export const wishlistStateFn = createServerFn({ method: "GET" }).handler(async () => wishlistForSession());

export const toggleWishlistFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ productId: z.string().min(2).max(80) }).parse(input))
  .handler(async ({ data }) => toggleWishlistForSession(data.productId));

export const mergeWishlistFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ productIds: z.array(z.string().min(2).max(80)).max(40) }).parse(input))
  .handler(async ({ data }) => mergeWishlistForSession(data.productIds));
