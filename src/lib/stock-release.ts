/** Pure reservation check. Callers must not clamp a shortfall to zero. */

export function releaseDecision(
  reserved: number,
  quantity: number,
): { ok: true; nextReserved: number } | { ok: false; reserved: number; quantity: number } {
  if (!Number.isInteger(reserved) || !Number.isInteger(quantity) || quantity < 1 || reserved < quantity) {
    return { ok: false, reserved, quantity };
  }
  return { ok: true, nextReserved: reserved - quantity };
}

export function sellableStock(onHand: number, reserved: number): number {
  return onHand - reserved;
}

/** Historical orders restore the coupon they stored, never whichever row now wears the old code. */
export function couponRestoreId(couponId: string | null | undefined): string | null {
  const id = couponId?.trim() ?? "";
  return id.length > 0 ? id : null;
}
