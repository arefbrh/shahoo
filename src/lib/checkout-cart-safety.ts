import type { CheckoutCartExpectation } from "./commerce-types.ts";

type ComparableCart = {
  cartId?: string;
  lines: ReadonlyArray<{ variantId: string; quantity: number; unitPriceIrr: number }>;
};

/** Compare identities and reviewed quantities/prices, not totals supplied by the client. */
export function sameCheckoutCart(expected: ComparableCart, current: ComparableCart): boolean {
  if (expected.cartId !== current.cartId || expected.lines.length !== current.lines.length) return false;
  const remaining = new Map(expected.lines.map((line) => [line.variantId, line]));
  if (remaining.size !== expected.lines.length) return false;
  for (const line of current.lines) {
    const reviewed = remaining.get(line.variantId);
    if (!reviewed || reviewed.quantity !== line.quantity || reviewed.unitPriceIrr !== line.unitPriceIrr) return false;
    remaining.delete(line.variantId);
  }
  return remaining.size === 0;
}

export function checkoutCartExpectation(cart: ComparableCart, ownerMobile?: string | null): CheckoutCartExpectation | null {
  if (!cart.cartId || cart.lines.length === 0) return null;
  return {
    cartId: cart.cartId,
    lines: cart.lines.map(({ variantId, quantity, unitPriceIrr }) => ({ variantId, quantity, unitPriceIrr })),
    ...(ownerMobile !== undefined ? { ownerMobile } : {}),
  };
}

/** Undefined is the legacy no-expectation case; null explicitly means guest. */
export function checkoutOwnerExpectationMatches(expected: string | null | undefined, observed: string | null): boolean {
  return expected === undefined || expected === observed;
}

export function checkoutIntentsBlocked(intents: { storageAvailable: boolean; retry: unknown; retryInvalid: boolean; addPending: boolean }): boolean {
  return !intents.storageAvailable || !!intents.retry || intents.retryInvalid || intents.addPending;
}

/** A read is usable only if no local cart event, write or retry intervened. */
export function checkoutReadIsCurrent(
  started: { revision: number; generation: number },
  now: { revision: number; generation: number; pending: boolean; retry: boolean },
): boolean {
  return started.revision === now.revision && started.generation === now.generation && !now.pending && !now.retry;
}

/** Never apply an identity read that crossed a focus loss or cart change. */
export function checkoutIdentityReadDecision(
  expected: string | null,
  observed: string | null,
  started: { revision: number; generation: number },
  now: { revision: number; generation: number; pending: boolean; retry: boolean; focused: boolean; visible: boolean },
): "stale" | "owner_changed" | "current" {
  if (!now.focused || !now.visible || !checkoutReadIsCurrent(started, now)) return "stale";
  return expected === observed ? "current" : "owner_changed";
}
