import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CartMutation, CartSnapshot, CheckoutContext, OrderView, PlaceOrderResult, QuoteResult } from "@/lib/commerce-types";
import { addCartItem, adoptLocalLines, readCart, setCartItem } from "./cart";
import { checkoutContext, placeOrder, quoteCheckout } from "./checkout";
import { loadOrder } from "./orders";

const lineSchema = z.object({
  variantId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(20),
});

const checkoutSchema = z.object({
  fullName: z.string().max(80),
  mobile: z.string().max(20),
  province: z.string().max(40),
  city: z.string().max(40),
  addressLine: z.string().max(300),
  postalCode: z.string().max(20),
  plaque: z.string().max(20).default(""),
  unit: z.string().max(20).default(""),
  customerNote: z.string().max(400).default(""),
  shippingMethodId: z.string().min(3).max(80),
  couponCode: z.string().max(40).default(""),
  idempotencyKey: z.string().uuid(),
  addressId: z.string().max(80).nullable().optional(),
  cartExpectation: z.object({
    cartId: z.string().min(1).max(80),
    ownerMobile: z.string().min(1).max(20).nullable().optional(),
    lines: z.array(z.object({
      variantId: z.string().min(1).max(80),
      quantity: z.number().int().min(1).max(20),
      unitPriceIrr: z.number().int().nonnegative(),
    })).min(1),
  }).optional(),
});

export const getCart = createServerFn({ method: "GET" }).handler(async (): Promise<CartSnapshot> => readCart());

export const addCartItemFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => lineSchema.parse(input))
  .handler(async ({ data }): Promise<CartMutation> => addCartItem(data.variantId, data.quantity));

export const setCartItemFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ variantId: z.string().min(1).max(80), quantity: z.number().int().min(0).max(20), expectedCartId: z.string().min(1).max(80).optional(), expectedQuantity: z.number().int().min(0).max(20).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<CartMutation> => setCartItem(data.variantId, data.quantity, data.expectedCartId, data.expectedQuantity));

export const adoptLocalCartFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ items: z.array(lineSchema).max(30) }).parse(input))
  .handler(async ({ data }): Promise<CartSnapshot> => adoptLocalLines(data.items));

export const getCheckoutContext = createServerFn({ method: "GET" }).handler(async (): Promise<CheckoutContext> => checkoutContext());

export const quoteCheckoutFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ province: z.string().max(40).default(""), city: z.string().max(40).default(""), shippingMethodId: z.string().min(3).max(80), couponCode: z.string().max(40).default("") }).parse(input),
  )
  .handler(async ({ data }): Promise<QuoteResult> => quoteCheckout(data.shippingMethodId, data.couponCode, data.province, data.city));

export const placeOrderFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data }): Promise<PlaceOrderResult> => placeOrder(data));

export const getOrderFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ publicCode: z.string().min(4).max(32) }).parse(input))
  .handler(async ({ data }): Promise<OrderView | null> => loadOrder(data.publicCode));
