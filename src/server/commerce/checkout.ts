import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { CheckoutContext, PlaceOrderInput, PlaceOrderResult, QuoteResult, ShippingChoice } from "@/lib/commerce-types";
import { deliveryAreas } from "../offers/delivery-area";
import { isUnapprovedSeedShipping, servesDestination } from "@/lib/public-shipping";
import { recordNotice } from "../notify/events";
import { listAddresses, ownedAddress } from "../account/addresses";
import { writeAudit } from "../auth/audit";
import { rememberReceipt } from "../auth/cookies";
import { hashSessionToken, newSessionToken } from "../auth/crypto";
import { asTime, openDb } from "../auth/db";
import { maskMobile, normalizeIranMobile } from "../auth/mobile";
import { readCustomer } from "../auth/sessions";
import type { AppDatabase } from "../db/client";
import {
  cartItems,
  carts,
  coupons,
  inventory,
  inventoryLogs,
  orderEvents,
  orderItems,
  orders,
  productVariants,
  products,
  productCategories,
  shippingMethods,
} from "../db/schema";
import { isIdempotencyConflict } from "../db/sql-error";
import { checkoutIdempotencyKey, isLineSellable } from "../../lib/commerce-integrity.ts";
import { checkoutOwnerExpectationMatches, sameCheckoutCart } from "../../lib/checkout-cart-safety.ts";
import { payPingConfigured } from "../payments/payping.ts";
import { readLoginIp } from "../auth/request-ip";
import { reserveGuestCheckout } from "./guest-checkout-limit";
import { loadCart, resolveCart, type CartContext } from "./cart";
import {
  cleanText,
  evaluateCoupon,
  holdUntil,
  isIranProvince,
  normalizeCouponCode,
  normalizePostalCode,
  orderTotal,
  replayDecision,
  shippingCharge,
} from "./pricing";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CART_CHANGED = "سبد خرید یا قیمت کالاها تغییر کرده است. سبد را تازه‌سازی و سفارش را دوباره بررسی کنید.";
const OWNER_CHANGED = "حساب کاربری تغییر کرده است. برای حفظ اطلاعات، صفحه را کامل بارگذاری دوباره کنید.";

class CheckoutError extends Error {
  constructor(message: string, readonly code?: "cart_changed" | "owner_changed") {
    super(message);
    this.name = "CheckoutError";
  }
}

export async function checkoutContext(): Promise<CheckoutContext> {
  const db = await openDb();
  const cart = await resolveCart(db, false);
  const customer = await readCustomer(db);
  if (cart && cart.customerId !== (customer?.id ?? null)) throw new Error("Checkout session changed during context read");
  return {
    cart: cart ? await loadCart(db, cart.id) : { count: 0, lines: [], subtotalIrr: 0 },
    methods: await listMethods(db),
    paypingEnabled: Boolean(customer) && payPingConfigured(process.env),
    account: customer ? { fullName: customer.fullName, mobile: customer.mobile } : null,
    addresses: customer ? await listAddresses(db, customer.id) : [],
  };
}

export async function quoteCheckout(shippingMethodId: string, rawCoupon: string, province = "", city = ""): Promise<QuoteResult> {
  const db = await openDb();
  const cart = await resolveCart(db, false);
  const snapshot = cart ? await loadCart(db, cart.id) : { count: 0, lines: [], subtotalIrr: 0 };
  const [method] = await db
    .select()
    .from(shippingMethods)
    .where(and(eq(shippingMethods.id, shippingMethodId), eq(shippingMethods.isActive, true)))
    .limit(1);
  if (method && !servesDestination((await deliveryAreas(db)).get(method.id) ?? {}, province, city)) throw new CheckoutError("این روش برای مقصد انتخاب‌شده فعال نیست.");
  if (method && isUnapprovedSeedShipping(method)) {
    return {
      subtotalIrr: snapshot.subtotalIrr,
      discountIrr: 0,
      shippingIrr: 0,
      totalIrr: snapshot.subtotalIrr,
      couponApplied: false,
      couponMessage: "این روش ارسال هنوز تأیید نشده است.",
    };
  }
  const code = normalizeCouponCode(rawCoupon);
  let discount = 0;
  let couponApplied = false;
  let couponMessage: string | null = null;
  if (code === null) couponMessage = "شکل کد تخفیف درست نیست.";
  else if (code) {
    const decision = await priceCoupon(db, code, snapshot.subtotalIrr);
    if (decision.ok) {
      discount = decision.discountIrr;
      couponApplied = true;
      couponMessage = decision.description;
    } else couponMessage = decision.message;
  }
  if (!method) {
    return {
      subtotalIrr: snapshot.subtotalIrr,
      discountIrr: 0,
      shippingIrr: 0,
      totalIrr: snapshot.subtotalIrr,
      couponApplied: false,
      couponMessage: "روش ارسال معتبر نیست.",
    };
  }
  const merchandise = Math.max(0, snapshot.subtotalIrr - (couponApplied ? discount : 0));
  const shippingIrr = shippingCharge(method, merchandise);
  return {
    subtotalIrr: snapshot.subtotalIrr,
    discountIrr: couponApplied ? discount : 0,
    shippingIrr,
    totalIrr: orderTotal(snapshot.subtotalIrr, couponApplied ? discount : 0, shippingIrr),
    couponApplied,
    couponMessage,
  };
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const db = await openDb();
  const cart = await resolveCart(db, false);
  const customer = await readCustomer(db);
  const result = await commitCheckout(db, input, cart, customer);
  if (!result.ok) return result;
  rememberReceipt(result.publicCode, result.receiptToken);
  return { ok: true, orderId: result.orderId, publicCode: result.publicCode };
}

export async function commitCheckout(
  db: AppDatabase,
  input: PlaceOrderInput,
  cart: CartContext | null,
  customer: { id: string; fullName: string; mobile: string } | null,
): Promise<{ ok: true; orderId: string; publicCode: string; receiptToken: string } | { ok: false; message: string; code?: "cart_changed" | "owner_changed" }> {
  // This is a comparison with the authenticated session, never authorization from the client.
  if ((input.cartExpectation?.ownerMobile !== undefined && cart && cart.customerId !== (customer?.id ?? null)) || !checkoutOwnerExpectationMatches(input.cartExpectation?.ownerMobile, customer?.mobile ?? null)) {
    return { ok: false, message: OWNER_CHANGED, code: "owner_changed" };
  }
  if (!cart) return input.cartExpectation
    ? { ok: false, message: CART_CHANGED, code: "cart_changed" }
    : { ok: false, message: "سبد خالی است." };
  const idempotencyKey = checkoutIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) return { ok: false, message: "کلید ثبت سفارش معتبر نیست." };
  const saved = input.addressId && customer ? await ownedAddress(db, customer.id, input.addressId) : null;
  if (input.addressId && !customer) return { ok: false, message: "برای استفاده از نشانی ذخیره‌شده باید وارد حساب شوید." };
  if (input.addressId && !saved) return { ok: false, message: "این نشانی برای حساب شما نیست." };
  const address = resolveCheckoutAddress(input, customer, saved);
  if ("error" in address) return { ok: false, message: address.error };
  const addressId = saved?.id ?? null;
  const couponCode = normalizeCouponCode(input.couponCode);
  if (couponCode === null) return { ok: false, message: "شکل کد تخفیف درست نیست." };

  const [existing] = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1);
  if (existing) {
    if (replayDecision(existing.buyerKey, cart.buyerKey) !== "replay") {
      return { ok: false, message: "این تلاش ثبت سفارش برای این سبد نیست. صفحه را تازه کنید." };
    }
    return reopenReceipt(db, existing.id, existing.publicCode);
  }

  if (!customer) {
    const rate = await reserveGuestCheckout(db, { ip: readLoginIp(), cartKey: cart.buyerKey });
    if (!rate.ok) return { ok: false, message: `تعداد ثبت سفارش از این مرورگر یا شبکه زیاد است. ${rate.retryAfterSec} ثانیه دیگر تلاش کنید.` };
  }

  try {
    const receiptToken = newSessionToken();
    const created = await db.transaction(async (tx) => {
      const order = await insertOrder(tx, input, address, couponCode, cart, addressId, idempotencyKey, hashSessionToken(receiptToken));
      await writeAudit(tx, {
        actorType: customer ? "customer" : "anonymous",
        actorId: customer?.id ?? null,
        action: "order.placed",
        entityType: "order",
        entityId: order.id,
        metadata: { publicCode: order.publicCode, mobile: maskMobile(address.mobile), totalIrr: order.totalIrr },
      });
      return order;
    });
    return { ok: true, orderId: created.id, publicCode: created.publicCode, receiptToken };
  } catch (error) {
    if (error instanceof CheckoutError) {
      // A simultaneous request with this key may have consumed the cart while
      // this transaction waited for the cart lock. It is still a replay.
      if (error.code === "cart_changed") {
        const [again] = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1);
        if (again && replayDecision(again.buyerKey, cart.buyerKey) === "replay") {
          return reopenReceipt(db, again.id, again.publicCode);
        }
      }
      return { ok: false, message: error.message, ...(error.code ? { code: error.code } : {}) };
    }
    if (isIdempotencyConflict(error)) {
      const [again] = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1);
      if (again && replayDecision(again.buyerKey, cart.buyerKey) === "replay") {
        return reopenReceipt(db, again.id, again.publicCode);
      }
      return { ok: false, message: "ثبت دوباره این سفارش ممکن نیست. صفحه را تازه کنید." };
    }
    throw error;
  }
}

type Address = {
  fullName: string;
  mobile: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  plaque: string;
  unit: string;
  note: string;
};

type Tx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

async function insertOrder(
  tx: Tx,
  input: PlaceOrderInput,
  address: Address,
  couponCode: string,
  cart: CartContext,
  addressId: string | null,
  idempotencyKey: string,
  accessTokenHash: string,
): Promise<{ id: string; publicCode: string; totalIrr: number }> {
  const locked = await tx.select({ id: carts.id, customerId: carts.customerId }).from(carts).where(eq(carts.id, cart.id)).for("update");
  if (locked.length === 0) throw input.cartExpectation ? new CheckoutError(CART_CHANGED, "cart_changed") : new CheckoutError("سبد پیدا نشد.");
  if (input.cartExpectation?.ownerMobile !== undefined && locked[0]?.customerId !== cart.customerId) {
    throw new CheckoutError(OWNER_CHANGED, "owner_changed");
  }
  // Check all cart items, including any that the joins below cannot resolve.
  const cartRows = input.cartExpectation
    ? await tx.select({ variantId: cartItems.variantId }).from(cartItems).where(eq(cartItems.cartId, cart.id))
    : null;
  const rows = await tx
    .select({
      variantId: productVariants.id,
      quantity: cartItems.quantity,
      label: productVariants.label,
      sku: productVariants.sku,
      priceIrr: productVariants.priceIrr,
      variantStatus: productVariants.status,
      variantDeletedAt: productVariants.deletedAt,
      productName: products.name,
      productStatus: products.status,
      deletedAt: products.deletedAt,
      categoryActive: productCategories.isActive,
      categoryDeletedAt: productCategories.deletedAt,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cart.id));
  if (input.cartExpectation && (
    cartRows?.length !== rows.length ||
    !sameCheckoutCart(input.cartExpectation, {
      cartId: cart.id,
      lines: rows.map((row) => ({ variantId: row.variantId, quantity: row.quantity, unitPriceIrr: row.priceIrr })),
    })
  )) throw new CheckoutError(CART_CHANGED, "cart_changed");
  if (rows.length === 0) throw new CheckoutError("سبد خالی است.");

  let subtotal = 0;
  for (const row of rows) {
    if (
      !isLineSellable({
        productStatus: row.productStatus,
        variantStatus: row.variantStatus,
        variantDeletedAt: row.variantDeletedAt,
        productDeletedAt: row.deletedAt,
        categoryActive: row.categoryActive,
        categoryDeletedAt: row.categoryDeletedAt,
      })
    ) {
      throw new CheckoutError(`«${row.productName}» دیگر قابل فروش نیست.`);
    }
    if (row.quantity > row.onHand - row.reserved) {
      throw new CheckoutError(`موجودی «${row.productName}» کافی نیست.`);
    }
    subtotal += row.priceIrr * row.quantity;
  }

  const [method] = await tx
    .select()
    .from(shippingMethods)
    .where(and(eq(shippingMethods.id, input.shippingMethodId), eq(shippingMethods.isActive, true)))
    .limit(1);
  if (!method || isUnapprovedSeedShipping(method) || !servesDestination((await deliveryAreas(tx)).get(method.id) ?? {}, address.province, address.city)) throw new CheckoutError("روش ارسال معتبر نیست.");

  let discount = 0;
  let appliedCode: string | null = null;
  let appliedCouponId: string | null = null;
  if (couponCode) {
    const [coupon] = await tx.select().from(coupons).where(eq(coupons.code, couponCode)).limit(1);
    if (!coupon) throw new CheckoutError("این کد تخفیف پیدا نشد.");
    const decision = evaluateCoupon(subtotal, toRule(coupon), Date.now());
    if (!decision.ok) throw new CheckoutError(decision.message);
    const bumped = await tx
      .update(coupons)
      .set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(coupons.id, coupon.id),
          eq(coupons.isActive, true),
          sql`(${coupons.usageLimit} is null or ${coupons.usedCount} < ${coupons.usageLimit})`,
        ),
      )
      .returning({ id: coupons.id });
    if (bumped.length === 0) throw new CheckoutError("ظرفیت این کد تمام شده است.");
    discount = decision.discountIrr;
    appliedCode = coupon.code;
    appliedCouponId = coupon.id;
  }

  const shippingIrr = shippingCharge(method, Math.max(0, subtotal - discount));
  const totalIrr = orderTotal(subtotal, discount, shippingIrr);
  const now = Date.now();
  const orderId = `ord-${crypto.randomUUID()}`;
  let publicCode = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    publicCode = newPublicCode();
    const [clash] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.publicCode, publicCode)).limit(1);
    if (!clash) break;
    if (attempt === 4) throw new CheckoutError("ثبت سفارش موقتاً ممکن نیست. دوباره تلاش کنید.");
  }

  await tx.insert(orders).values({
    id: orderId,
    publicCode,
    customerId: cart.customerId,
    status: "awaiting_payment",
    fullName: address.fullName,
    mobile: address.mobile,
    province: address.province,
    city: address.city,
    addressLine: address.addressLine,
    postalCode: address.postalCode,
    plaque: address.plaque,
    unit: address.unit,
    customerNote: address.note,
    shippingMethodId: method.id,
    shippingTitle: method.title,
    subtotalIrr: subtotal,
    discountIrr: discount,
    shippingIrr,
    totalIrr,
    couponCode: appliedCode,
    couponId: appliedCouponId,
    idempotencyKey,
    buyerKey: cart.buyerKey,
    accessTokenHash,
    stockHoldUntil: new Date(holdUntil(now)),
    paymentStatus: "unpaid",
    stockState: "held",
    addressId,
  });

  for (const row of rows) {
    const reserved = await tx
      .update(inventory)
      .set({
        reserved: sql`${inventory.reserved} + ${row.quantity}`,
        updatedAt: new Date(),
      })
      .where(and(eq(inventory.variantId, row.variantId), sql`(${inventory.onHand} - ${inventory.reserved}) >= ${row.quantity}`))
      .returning({ variantId: inventory.variantId, onHand: inventory.onHand, reserved: inventory.reserved });
    if (reserved.length === 0) throw new CheckoutError(`موجودی «${row.productName}» کافی نیست.`);
    const stockAfter = reserved[0]!;
    await tx.insert(inventoryLogs).values({
      id: `ilog-${crypto.randomUUID()}`,
      variantId: row.variantId,
      delta: row.quantity,
      reason: "reserve_unpaid",
      note: publicCode,
      onHandBefore: stockAfter.onHand,
      onHandAfter: stockAfter.onHand,
      reservedBefore: stockAfter.reserved - row.quantity,
      reservedAfter: stockAfter.reserved,
      orderId,
    });
    await tx.insert(orderItems).values({
      id: `oi-${crypto.randomUUID()}`,
      orderId,
      variantId: row.variantId,
      productName: row.productName,
      variantLabel: row.label,
      sku: row.sku,
      quantity: row.quantity,
      unitPriceIrr: row.priceIrr,
      lineTotalIrr: row.priceIrr * row.quantity,
    });
  }

  await tx.insert(orderEvents).values({
    id: `oev-${crypto.randomUUID()}`,
    orderId,
    status: "awaiting_payment",
    note: "سفارش پرداخت‌نشده ثبت شد.",
    actor: cart.customerId ? "customer" : "guest",
  });
  await recordNotice(tx, {
    eventKey: "order.placed",
    detail: publicCode,
    recipient: address.mobile,
    customerId: cart.customerId,
    orderId,
  });
  for (const row of rows) {
    await consumeCartLines(tx, cart.id, [{ variantId: row.variantId, quantity: row.quantity }]);
  }
  return { id: orderId, publicCode, totalIrr };
}

export async function consumeCartLines(
  tx: Tx,
  cartId: string,
  lines: Array<{ variantId: string; quantity: number }>,
): Promise<void> {
  for (const row of lines) {
    const removed = await tx
      .delete(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, row.variantId), eq(cartItems.quantity, row.quantity)))
      .returning({ id: cartItems.id });
    if (removed.length !== 1) throw new CheckoutError("سبد هنگام ثبت تغییر کرد. دوباره تلاش کنید.");
  }
}

async function listMethods(db: AppDatabase): Promise<ShippingChoice[]> {
  const areas = await deliveryAreas(db);
  const rows = await db
    .select()
    .from(shippingMethods)
    .where(eq(shippingMethods.isActive, true))
    .orderBy(asc(shippingMethods.sortOrder));
  return rows
    .filter((row) => !isUnapprovedSeedShipping(row))
    .map((row) => ({
      id: row.id,
      ...areas.get(row.id),
      title: row.title,
      description: row.description,
      priceIrr: row.priceIrr,
      freeOverIrr: row.freeOverIrr,
    }));
}

async function priceCoupon(
  db: AppDatabase,
  code: string,
  subtotalIrr: number,
): Promise<{ ok: true; discountIrr: number; description: string } | { ok: false; message: string }> {
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  if (!coupon) return { ok: false, message: "این کد تخفیف پیدا نشد." };
  const decision = evaluateCoupon(subtotalIrr, toRule(coupon), Date.now());
  if (!decision.ok) return decision;
  return { ok: true, discountIrr: decision.discountIrr, description: coupon.description || "کد اعمال شد." };
}

function toRule(coupon: {
  isActive: boolean;
  percentOff: number | null;
  amountOffIrr: number | null;
  minSubtotalIrr: number;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  usageLimit: number | null;
  usedCount: number;
}) {
  return {
    isActive: coupon.isActive,
    percentOff: coupon.percentOff,
    amountOffIrr: coupon.amountOffIrr,
    minSubtotalIrr: coupon.minSubtotalIrr,
    startsAt: coupon.startsAt ? asTime(coupon.startsAt) : null,
    endsAt: coupon.endsAt ? asTime(coupon.endsAt) : null,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
  };
}

export function resolveCheckoutAddress(
  input: PlaceOrderInput,
  customer: { fullName: string; mobile: string } | null,
  saved: { recipientName: string; recipientMobile: string; province: string; city: string; addressLine: string; postalCode: string; plaque: string; unit: string } | null,
): Address | { error: string } {
  if (input.addressId) {
    if (!customer || !saved) return { error: "این نشانی برای حساب شما نیست." };
    const fullName = (saved.recipientName.trim() || input.fullName.trim() || customer.fullName).slice(0, 80);
    if (fullName.length < 3) return { error: "نام گیرنده را کامل بنویسید." };
    const mobile = saved.recipientMobile ? normalizeIranMobile(saved.recipientMobile) : customer.mobile;
    if (!mobile) return { error: "شماره موبایل گیرنده معتبر نیست." };
    const note = optionalText(input.customerNote, "توضیح");
    if (typeof note !== "string") return { error: note.error };
    return {
      fullName,
      mobile,
      province: saved.province,
      city: saved.city,
      addressLine: saved.addressLine,
      postalCode: saved.postalCode,
      plaque: saved.plaque,
      unit: saved.unit,
      note,
    };
  }
  return readAddress(input, customer?.mobile ?? null);
}

function readAddress(input: PlaceOrderInput, mobileOverride: string | null): Address | { error: string } {
  const fullName = cleanText(input.fullName, 2, 80);
  if (!fullName) return { error: "نام را بین ۲ تا ۸۰ حرف بنویسید." };
  const city = cleanText(input.city, 2, 40);
  if (!city) return { error: "شهر را بنویسید." };
  const addressLine = cleanText(input.addressLine, 8, 300);
  if (!addressLine) return { error: "نشانی را کامل‌تر بنویسید." };
  if (!isIranProvince(input.province)) return { error: "استان را از فهرست انتخاب کنید." };
  const postalCode = normalizePostalCode(input.postalCode);
  if (!postalCode) return { error: "کد پستی باید ۱۰ رقم باشد." };
  const mobile = mobileOverride ?? normalizeIranMobile(input.mobile);
  if (!mobile) return { error: "شماره موبایل معتبر نیست." };
  const plaque = optionalText(input.plaque, "پلاک");
  if (typeof plaque !== "string") return { error: plaque.error };
  const unit = optionalText(input.unit, "واحد");
  if (typeof unit !== "string") return { error: unit.error };
  const note = optionalText(input.customerNote, "توضیح");
  if (typeof note !== "string") return { error: note.error };
  return { fullName, mobile, province: input.province, city, addressLine, postalCode, plaque, unit, note };
}

function optionalText(value: string, label: string): string | { error: string } {
  if (!value.trim()) return "";
  const text = cleanText(value, 1, label === "توضیح" ? 400 : 20);
  if (!text) return { error: `${label} معتبر نیست.` };
  return text;
}

function newPublicCode(now = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
  const bytes = randomBytes(4);
  let suffix = "";
  for (const byte of bytes) suffix += ALPHABET[byte % ALPHABET.length] ?? "A";
  return `SH-${day}-${suffix}`;
}

async function reopenReceipt(
  db: AppDatabase,
  orderId: string,
  publicCode: string,
): Promise<{ ok: true; orderId: string; publicCode: string; receiptToken: string }> {
  const token = newSessionToken();
  await db.update(orders).set({ accessTokenHash: hashSessionToken(token) }).where(eq(orders.id, orderId));
  return { ok: true, orderId, publicCode, receiptToken: token };
}
