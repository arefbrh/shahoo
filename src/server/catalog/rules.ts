export {
  applyStockDelta,
  canPublish,
  chooseDefaultIndex,
  chooseSellableDefault,
  cleanCatalogText,
  ICON_TYPES,
  normalizeSku,
  normalizeSlug,
  parseIconType,
  parseImageUrl,
  parseToman,
  parseWhole,
} from "../../lib/catalog-rules.ts";

export type { IconType } from "../../lib/catalog-rules.ts";

/** Null or omitted means no catalog price cap. An explicit maximum still filters. */
export function passesMaxPrice(priceToman: number, maxToman: number | null | undefined): boolean {
  if (maxToman == null) return true;
  return priceToman <= maxToman;
}
