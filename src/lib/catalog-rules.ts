import { hasUnsafeText } from "./text-safety.ts";

const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";
const RIALS_PER_TOMAN = 10;

export const ICON_TYPES = ["oils", "butters", "nuts", "herbs"] as const;
export type IconType = (typeof ICON_TYPES)[number];

/** Whole toman or stock amounts typed with Persian, Arabic, or ASCII digits. */
export function parseWhole(input: string): number | null {
  let digits = "";
  let negative = false;
  for (const char of input.trim()) {
    if ((char === "-" || char === "−") && digits.length === 0 && !negative) {
      negative = true;
      continue;
    }
    const persian = PERSIAN.indexOf(char);
    const arabic = ARABIC.indexOf(char);
    if (persian >= 0) digits += String(persian);
    else if (arabic >= 0) digits += String(arabic);
    else if (char >= "0" && char <= "9") digits += char;
    else if (char === "," || char === "٬" || char === " ") continue;
    else return null;
  }
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return negative ? -value : value;
}

export function normalizeSlug(input: string): string | null {
  const slug = input.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 80) return null;
  return slug;
}

export function normalizeSku(input: string): string | null {
  const sku = input.trim().toUpperCase();
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(sku) || sku.length < 2 || sku.length > 40) return null;
  return sku;
}

export function cleanCatalogText(value: string, min: number, max: number): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) return null;
  if (hasUnsafeText(text)) return null;
  return text;
}

export function parseToman(input: number): { ok: true; irr: number } | { ok: false; message: string } {
  if (!Number.isInteger(input) || input < 0 || input > 50_000_000) {
    return { ok: false, message: "قیمت باید عدد صحیح تومان، از صفر تا ۵۰ میلیون باشد." };
  }
  return { ok: true, irr: input * RIALS_PER_TOMAN };
}

export function parseImageUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return "";
  if (value.length > 500) return null;
  if (/^\/media\/file\/med-[A-Za-z0-9-]{8,80}$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export function parseIconType(input: string): IconType | null {
  return (ICON_TYPES as readonly string[]).includes(input) ? (input as IconType) : null;
}

export function chooseDefaultIndex(flags: boolean[]): number {
  const marked = flags.findIndex(Boolean);
  return marked >= 0 ? marked : 0;
}

/** Prefer an active package as the single default so the storefront card stays sellable. */
export function chooseSellableDefault(rows: Array<{ isDefault: boolean; active: boolean }>): number {
  const activeMarked = rows.findIndex((row) => row.isDefault && row.active);
  if (activeMarked >= 0) return activeMarked;
  const firstActive = rows.findIndex((row) => row.active);
  if (firstActive >= 0) return firstActive;
  return chooseDefaultIndex(rows.map((row) => row.isDefault));
}

export function canPublish(activeCount: number): boolean {
  return activeCount > 0;
}

export function applyStockDelta(
  onHand: number,
  reserved: number,
  delta: number,
): { ok: true; next: number } | { ok: false; message: string } {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 5000) {
    return { ok: false, message: "اصلاح موجودی باید عدد صحیح غیرصفر و حداکثر ۵۰۰۰ باشد." };
  }
  const next = onHand + delta;
  if (next < 0) return { ok: false, message: "موجودی نمی‌تواند منفی شود." };
  if (next < reserved) {
    return { ok: false, message: "موجودی از مقدار رزروشده برای سفارش‌های پرداخت‌نشده کمتر است." };
  }
  return { ok: true, next };
}
