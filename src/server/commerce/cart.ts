import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { CartMutation, CartSnapshot } from "@/lib/commerce-types";
import { cartSetDecision } from "../../lib/cart-concurrency.ts";
import { combinedCartQuantity, isLineSellable } from "../../lib/commerce-integrity.ts";
import { clearCartToken, readCartToken, writeCartToken } from "../auth/cookies";
import { hashSessionToken, newSessionToken } from "../auth/crypto";
import { openDb } from "../auth/db";
import { readCustomer } from "../auth/sessions";
import type { AppDatabase } from "../db/client";
import { cartItems, carts, inventory, productCategories, productImages, productVariants, products } from "../db/schema";
import { releaseExpiredHolds } from "./holds";
import { clampLineQuantity } from "./pricing";

export type CartContext = {
  id: string;
  customerId: string | null;
  buyerKey: string;
};

type StockRow = {
  variantId: string;
  onHand: number;
  reserved: number;
  priceIrr: number;
  label: string;
  sku: string;
  variantStatus: string;
  variantDeletedAt: Date | string | null;
  productName: string;
  slug: string;
  productStatus: string;
  productDeletedAt: Date | null;
  categoryActive: boolean;
  categoryDeletedAt: Date | null;
};

type CartQuery = Pick<AppDatabase, "select" | "insert" | "update" | "delete">;

export async function claimGuestCart(db: AppDatabase, customerId: string): Promise<void> {
  const token = readCartToken();
  if (!token) return;
  const [guest] = await db.select().from(carts).where(eq(carts.guestTokenHash, hashSessionToken(token))).limit(1);
  if (!guest || (guest.customerId && guest.customerId !== customerId)) {
    clearCartToken();
    return;
  }
  const [owned] = await db.select().from(carts).where(eq(carts.customerId, customerId)).limit(1);
  if (owned && owned.id !== guest.id) {
    await mergeCartInto(db, owned.id, guest.id);
  } else if (!owned) {
    await db
      .update(carts)
      .set({ customerId, guestTokenHash: null, updatedAt: new Date() })
      .where(eq(carts.id, guest.id));
  }
  clearCartToken();
}

export async function readCart(): Promise<CartSnapshot> {
  const db = await openDb();
  const cart = await resolveCart(db, false);
  if (!cart) return { count: 0, lines: [], subtotalIrr: 0 };
  return loadCart(db, cart.id);
}

export async function addCartItem(variantId: string, quantity: number): Promise<CartMutation> {
  const db = await openDb();
  const cart = await resolveCart(db, true);
  if (!cart) return { ok: false, message: "سبد ساخته نشد.", cart: { count: 0, lines: [], subtotalIrr: 0 } };
  const row = await findVariant(db, variantId);
  if (!row || !isLineSellable({ ...row, productFound: true })) {
    return { ok: false, message: "این بسته دیگر قابل فروش نیست.", cart: await loadCart(db, cart.id) };
  }
  const sellable = row.onHand - row.reserved;
  const changed = await mutateCartLine(db, cart.id, variantId, "add", quantity, sellable, isLineSellable({ ...row, productFound: true }));
  if (!changed.ok) return { ok: false, message: changed.message, cart: await loadCart(db, cart.id) };
  const limited = changed.quantity < (changed.previous + quantity);
  return {
    ok: true,
    message: limited ? "تعداد با موجودی قابل فروش هماهنگ شد." : null,
    cart: await loadCart(db, cart.id),
  };
}

export async function setCartItem(variantId: string, quantity: number, expectedCartId?: string, expectedQuantity?: number): Promise<CartMutation> {
  const db = await openDb();
  const cart = await resolveCart(db, false);
  if (expectedCartId && cart?.id !== expectedCartId) {
    return { ok: false, message: "سبد این نشست تغییر کرده است. سبد را بررسی کنید و تغییر را دوباره انتخاب کنید.", cart: cart ? await loadCart(db, cart.id) : { count: 0, lines: [], subtotalIrr: 0 } };
  }
  if (!cart) return { ok: true, message: null, cart: { count: 0, lines: [], subtotalIrr: 0 } };
  if (quantity < 1) {
    const changed = await mutateCartLine(db, cart.id, variantId, "set", 0, 0, false, expectedQuantity);
    return { ok: changed.ok, message: changed.ok ? null : changed.message, cart: await loadCart(db, cart.id) };
  }
  const row = await findVariant(db, variantId);
  if (!row || !isLineSellable({ ...row, productFound: true })) {
    await mutateCartLine(db, cart.id, variantId, "set", 0, 0, false);
    return { ok: false, message: "این بسته دیگر قابل فروش نیست.", cart: await loadCart(db, cart.id) };
  }
  const sellable = row.onHand - row.reserved;
  const changed = await mutateCartLine(db, cart.id, variantId, "set", quantity, sellable, true, expectedQuantity);
  if (!changed.ok) return { ok: false, message: changed.message, cart: await loadCart(db, cart.id) };
  return {
    ok: true,
    message: changed.quantity < quantity ? "تعداد با موجودی قابل فروش هماهنگ شد." : null,
    cart: await loadCart(db, cart.id),
  };
}

export async function adoptLocalLines(items: Array<{ variantId: string; quantity: number }>): Promise<CartSnapshot> {
  const db = await openDb();
  const cart = await resolveCart(db, true);
  if (!cart) return { count: 0, lines: [], subtotalIrr: 0 };
  await adoptLinesIntoCart(db, cart.id, items);
  return loadCart(db, cart.id);
}

export async function resolveCart(db: AppDatabase, create: boolean): Promise<CartContext | null> {
  await releaseExpiredHolds(db);
  const customer = await readCustomer(db);
  if (customer) {
    await claimGuestCart(db, customer.id);
    let [owned] = await db.select().from(carts).where(eq(carts.customerId, customer.id)).limit(1);
    if (!owned) {
      if (!create) return null;
      const id = `cart-${crypto.randomUUID()}`;
      await db.insert(carts).values({ id, customerId: customer.id, guestTokenHash: null });
      owned = { id, customerId: customer.id, guestTokenHash: null, createdAt: new Date(), updatedAt: new Date() };
    }
    return { id: owned.id, customerId: customer.id, buyerKey: `c:${customer.id}` };
  }

  const token = readCartToken();
  if (token) {
    const [guest] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.guestTokenHash, hashSessionToken(token)), isNull(carts.customerId)))
      .limit(1);
    if (guest) return { id: guest.id, customerId: null, buyerKey: `g:${guest.id}` };
  }
  if (!create) return null;
  const nextToken = newSessionToken();
  const id = `cart-${crypto.randomUUID()}`;
  await db.insert(carts).values({ id, customerId: null, guestTokenHash: hashSessionToken(nextToken) });
  writeCartToken(nextToken);
  return { id, customerId: null, buyerKey: `g:${id}` };
}

export async function loadCart(db: AppDatabase, cartId: string): Promise<CartSnapshot> {
  return db.transaction(async (tx) => {
    // Reads can remove or clamp lines; use the same cart lock as writers so a
    // stale cleanup cannot overwrite a newer customer change.
    const locked = await tx.select({ id: carts.id }).from(carts).where(eq(carts.id, cartId)).for("update").limit(1);
    if (!locked.length) return { count: 0, lines: [], subtotalIrr: 0 };
    const rows = await tx
      .select({
        itemId: cartItems.id,
        quantity: cartItems.quantity,
        variantId: productVariants.id,
        label: productVariants.label,
        priceIrr: productVariants.priceIrr,
        variantStatus: productVariants.status,
        productName: products.name,
        slug: products.slug,
        imageUrl: productImages.url,
        productStatus: products.status,
        productDeletedAt: products.deletedAt,
        variantDeletedAt: productVariants.deletedAt,
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
      .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)))
      .where(eq(cartItems.cartId, cartId));

    const lines: CartSnapshot["lines"] = [];
    for (const row of rows) {
      if (!isLineSellable({ ...row, productFound: true })) {
        await tx.delete(cartItems).where(eq(cartItems.id, row.itemId));
        continue;
      }
      const sellable = Math.max(0, row.onHand - row.reserved);
      const quantity = clampLineQuantity(row.quantity, sellable);
      if (quantity < 1) {
        await tx.delete(cartItems).where(eq(cartItems.id, row.itemId));
        continue;
      }
      if (quantity !== row.quantity) {
        await tx.update(cartItems).set({ quantity }).where(eq(cartItems.id, row.itemId));
      }
      lines.push({
        variantId: row.variantId,
        slug: row.slug,
        name: row.productName,
        imageUrl: row.imageUrl ?? "",
        label: row.label,
        quantity,
        unitPriceIrr: row.priceIrr,
        lineTotalIrr: row.priceIrr * quantity,
        sellable,
      });
    }
    lines.sort((a, b) => a.name.localeCompare(b.name, "fa"));
    return {
      cartId,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      lines,
      subtotalIrr: lines.reduce((sum, line) => sum + line.lineTotalIrr, 0),
    };
  });
}

export async function mergeCartInto(db: AppDatabase, targetId: string, sourceId: string): Promise<{ merged: boolean }> {
  if (targetId === sourceId) return { merged: false };
  return db.transaction(async (tx) => {
    const first = targetId < sourceId ? targetId : sourceId;
    const second = targetId < sourceId ? sourceId : targetId;
    const locked = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(inArray(carts.id, [first, second]))
      .orderBy(asc(carts.id))
      .for("update");
    if (!locked.some((row) => row.id === sourceId) || !locked.some((row) => row.id === targetId)) return { merged: false };
    const sourceItems = await tx.select().from(cartItems).where(eq(cartItems.cartId, sourceId));
    for (const item of sourceItems) {
      const variant = await findVariant(tx, item.variantId);
      const sellable = variant && isLineSellable({ ...variant, productDeletedAt: variant.productDeletedAt, productFound: true }) ? variant.onHand - variant.reserved : 0;
      const [existing] = await tx
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, targetId), eq(cartItems.variantId, item.variantId)))
        .limit(1);
      const next = combinedCartQuantity(existing?.quantity ?? 0, item.quantity, sellable, "sum");
      if (next < 1) {
        if (existing) await tx.delete(cartItems).where(eq(cartItems.id, existing.id));
        continue;
      }
      if (existing) await tx.update(cartItems).set({ quantity: next }).where(eq(cartItems.id, existing.id));
      else {
        await tx.insert(cartItems).values({
          id: `ci-${crypto.randomUUID()}`,
          cartId: targetId,
          variantId: item.variantId,
          quantity: next,
        });
      }
    }
    await tx.delete(carts).where(eq(carts.id, sourceId));
    await touchCart(tx, targetId);
    return { merged: true };
  });
}

/** Local lines join with max(), so repeating the same request does not add the quantity again. */
export async function adoptLinesIntoCart(
  db: AppDatabase,
  cartId: string,
  items: Array<{ variantId: string; quantity: number }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const locked = await tx.select({ id: carts.id }).from(carts).where(eq(carts.id, cartId)).for("update").limit(1);
    if (locked.length === 0) return;
    for (const item of items.slice(0, 30)) {
      const variant = await findVariant(tx, item.variantId);
      if (!variant || !isLineSellable({ ...variant, productDeletedAt: variant.productDeletedAt, productFound: true })) continue;
      const [existing] = await tx
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, item.variantId)))
        .limit(1);
      const next = combinedCartQuantity(existing?.quantity ?? 0, item.quantity, variant.onHand - variant.reserved, "max");
      if (next < 1) continue;
      if (existing) {
        if (existing.quantity !== next) await tx.update(cartItems).set({ quantity: next }).where(eq(cartItems.id, existing.id));
      } else {
        await tx.insert(cartItems).values({
          id: `ci-${crypto.randomUUID()}`,
          cartId,
          variantId: item.variantId,
          quantity: next,
        });
      }
    }
    await touchCart(tx, cartId);
  });
}

export async function mutateCartLine(
  db: AppDatabase,
  cartId: string,
  variantId: string,
  mode: "add" | "set",
  quantity: number,
  sellable: number,
  sellableVariant: boolean,
  expectedQuantity?: number,
): Promise<{ ok: true; quantity: number; previous: number } | { ok: false; message: string }> {
  return db.transaction(async (tx) => {
    const locked = await tx.select({ id: carts.id }).from(carts).where(eq(carts.id, cartId)).for("update").limit(1);
    if (locked.length === 0) return { ok: false, message: "سبد پیدا نشد." };
    const [existing] = await tx
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
      .limit(1);
    const previous = existing?.quantity ?? 0;
    if (mode === "set") {
      const decision = cartSetDecision(previous, expectedQuantity);
      if (decision === "conflict") return { ok: false, message: "تعداد این کالا تغییر کرده است؛ ممکن است تغییر قبلی ثبت شده باشد. سبد تازه را بررسی کنید، از تغییر تأییدنشده صرف‌نظر کنید و در صورت نیاز دوباره انتخاب کنید." };
    }
    if (!sellableVariant || quantity < 1) {
      if (existing) await tx.delete(cartItems).where(eq(cartItems.id, existing.id));
      await touchCart(tx, cartId);
      if (!sellableVariant && mode === "set" && quantity < 1) return { ok: true, quantity: 0, previous };
      return { ok: false, message: sellableVariant ? "تعداد معتبر نیست." : "این بسته دیگر قابل فروش نیست." };
    }
    const [stock] = await tx
      .select({ onHand: inventory.onHand, reserved: inventory.reserved })
      .from(inventory)
      .where(eq(inventory.variantId, variantId))
      .for("update")
      .limit(1);
    const liveSellable = Math.min(sellable, (stock?.onHand ?? 0) - (stock?.reserved ?? 0));
    const requested = mode === "add" ? previous + quantity : quantity;
    const next = clampLineQuantity(requested, liveSellable);
    if (next < 1) {
      if (existing) await tx.delete(cartItems).where(eq(cartItems.id, existing.id));
      await touchCart(tx, cartId);
      return { ok: false, message: "موجودی این بسته تمام شده است." };
    }
    if (existing) await tx.update(cartItems).set({ quantity: next }).where(eq(cartItems.id, existing.id));
    else {
      await tx.insert(cartItems).values({
        id: `ci-${crypto.randomUUID()}`,
        cartId,
        variantId,
        quantity: next,
      });
    }
    await touchCart(tx, cartId);
    return { ok: true, quantity: next, previous };
  });
}

async function findVariant(db: CartQuery, variantId: string): Promise<StockRow | null> {
  const [row] = await db
    .select({
      variantId: productVariants.id,
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      priceIrr: productVariants.priceIrr,
      label: productVariants.label,
      sku: productVariants.sku,
      variantStatus: productVariants.status,
      variantDeletedAt: productVariants.deletedAt,
      productName: products.name,
      slug: products.slug,
      productStatus: products.status,
      productDeletedAt: products.deletedAt,
      categoryActive: productCategories.isActive,
      categoryDeletedAt: productCategories.deletedAt,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
    .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(eq(productVariants.id, variantId))
    .limit(1);
  return row ?? null;
}

async function touchCart(db: CartQuery, cartId: string): Promise<void> {
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
}
