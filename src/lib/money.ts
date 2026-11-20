/** 1 toman = 10 rials. Database amounts are integer rials. */
export const RIALS_PER_TOMAN = 10;

export function tomanToIrr(toman: number): number {
  if (!Number.isInteger(toman)) {
    throw new Error("Toman amounts must be integers before conversion");
  }
  return toman * RIALS_PER_TOMAN;
}

export function irrToToman(irr: number): number {
  return Math.trunc(irr / RIALS_PER_TOMAN);
}
