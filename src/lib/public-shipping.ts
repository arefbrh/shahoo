import { tomanToIrr } from "./money.ts";

export type ShippingSnapshot = {
  id?: string;
  key?: string;
  priceIrr: number;
  freeOverIrr: number | null;
};

/** Prices and free-shipping thresholds that the old baseline invented. A different price or threshold is treated as an explicit shop setting. */
const UNAPPROVED_PRICES: Array<{ key: string; priceIrr: number; freeOverIrr: number | null }> = [
  { key: "post", priceIrr: tomanToIrr(85_000), freeOverIrr: tomanToIrr(1_500_000) },
  { key: "tipax", priceIrr: tomanToIrr(120_000), freeOverIrr: tomanToIrr(2_500_000) },
];

export function isUnapprovedSeedShipping(row: ShippingSnapshot): boolean {
  if (row.id === "ship-manual" && row.priceIrr === 0 && row.freeOverIrr == null) return true;
  const key = row.key ?? "";
  return UNAPPROVED_PRICES.some(
    (item) => item.key === key && item.priceIrr === row.priceIrr && item.freeOverIrr === (row.freeOverIrr ?? null),
  );
}
