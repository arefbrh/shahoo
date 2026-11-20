import type { SectionConfigDraft, SectionFlag } from "./cms-types.ts";
import { isLocalMediaUrl } from "./media-bytes.ts";
import { tehranDayEnd, tehranDayStart } from "./tehran-time.ts";

export const SECTION_TYPES = [
  "hero",
  "featured_categories",
  "best_sellers",
  "new_arrivals",
  "special_offers",
  "brand_introduction",
  "brand_benefits",
  "featured_products",
  "magazine_articles",
  "newsletter",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const PRODUCT_SECTION_TYPES = ["best_sellers", "new_arrivals", "special_offers", "featured_products"] as const;

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "اسلایدر نخست",
  featured_categories: "دسته‌ها",
  best_sellers: "پرفروش‌ها",
  new_arrivals: "تازه‌ها",
  special_offers: "پیشنهادها",
  brand_introduction: "معرفی شاهو",
  brand_benefits: "تعهد کارگاه",
  featured_products: "برگزیده‌ها",
  magazine_articles: "مجله",
  newsletter: "خبر محصولات",
};

export const PRODUCT_FLAGS = ["featured", "best", "offer", "newest"] as const;

export const FLAG_LABELS: Record<SectionFlag, string> = {
  featured: "برگزیده",
  best: "پرفروش",
  offer: "قیمت قبلی",
  newest: "تازه‌تر",
};

export const MENU_KEYS = ["header", "footer-shop", "footer-help"] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function hasUnsafeControl(value: string, allowBreaks: boolean): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 127) return true;
    if (code < 32 && !(allowBreaks && (char === "\n" || char === "\t"))) return true;
  }
  return false;
}

export function cleanInline(value: string, min: number, max: number): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) return null;
  if (/[<>]/.test(text) || hasUnsafeControl(text, false)) return null;
  return text;
}

export function cleanBody(value: string, min: number, max: number): string | null {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (text.length < min || text.length > max) return null;
  if (/[<>]/.test(text) || hasUnsafeControl(text, true)) return null;
  return text;
}

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

export function isProductSection(value: string): boolean {
  return (PRODUCT_SECTION_TYPES as readonly string[]).includes(value);
}

/** Retain legacy records, but never publish the removed section or its visible title. */
export function isPublicHomeSection(section: { id?: string; sectionType: string; title: string }): boolean {
  if (section.id === "sec-featured") return false;
  return section.sectionType === "hero" || section.title.trim() !== "برگزیده‌ها";
}

export function normalizeSectionConfig(
  sectionType: string,
  input: SectionConfigDraft,
): { ok: true; config: SectionConfigDraft } | { ok: false; message: string } {
  if (isProductSection(sectionType)) {
    const limit = input.limit ?? 4;
    if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
      return { ok: false, message: "تعداد نمایش باید عدد ۱ تا ۱۲ باشد." };
    }
    const flags = input.flags ?? [];
    if (flags.some((flag) => !(PRODUCT_FLAGS as readonly string[]).includes(flag))) {
      return { ok: false, message: "نشان بخش شناخته نشد." };
    }
    return { ok: true, config: { limit, flags: [...new Set(flags)] } };
  }
  if (sectionType === "brand_benefits") {
    const items = input.items ?? [];
    if (items.length < 1 || items.length > 6) return { ok: false, message: "تعهدها باید بین ۱ تا ۶ مورد باشند." };
    const clean = [];
    for (const item of items) {
      const title = cleanInline(item.title, 2, 60);
      const text = cleanInline(item.text, 2, 240);
      if (!title || !text) return { ok: false, message: "عنوان و متن هر تعهد لازم است." };
      clean.push({ title, text });
    }
    return { ok: true, config: { items: clean } };
  }
  return { ok: true, config: {} };
}

/** Requested ids must be exactly the current rows, once each. */
export function permutationOrder(currentIds: string[], requested: string[]): string[] | null {
  if (requested.length !== currentIds.length || requested.length === 0) return null;
  if (new Set(requested).size !== requested.length) return null;
  const known = new Set(currentIds);
  if (!requested.every((id) => known.has(id))) return null;
  return requested;
}

export function parsePublicHref(input: string): string | null {
  const text = input.trim();
  if (!text || text.length > 300 || /[\s<>]/.test(text) || hasUnsafeControl(text, false)) return null;
  if (text.startsWith("/")) {
    if (text.startsWith("//") || text.includes("\\") || text.includes("..")) return null;
    return text;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  return url.toString();
}

export function parseExternalMediaUrl(input: string): string | null {
  const href = parsePublicHref(input);
  if (!href || !href.startsWith("https://")) return null;
  const pathname = new URL(href).pathname.toLowerCase();
  const known = Object.keys(IMAGE_MIME).some((ext) => pathname.endsWith(ext));
  return known ? href : null;
}

export function imageMimeFromUrl(url: string): string | null {
  const href = parseExternalMediaUrl(url);
  if (!href) return null;
  const pathname = new URL(href).pathname.toLowerCase();
  const ext = Object.keys(IMAGE_MIME).find((item) => pathname.endsWith(item));
  return ext ? IMAGE_MIME[ext] : null;
}

export function filenameFromUrl(url: string): string {
  const base = new URL(url).pathname.split("/").pop() ?? "image";
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80);
  return clean || "image";
}

export function isOfficialBrandAsset(publicUrl: string): boolean {
  return publicUrl.startsWith("/assets/brand/") && !publicUrl.includes("..");
}

export function isRenderableMediaUrl(url: string): boolean {
  return isOfficialBrandAsset(url) || parseExternalMediaUrl(url) !== null;
}

/** Banner art may be an official file, a library upload, or an https image. */
export function safeBannerImage(url: string | null | undefined): string {
  const value = (url ?? "").trim();
  if (!value || value.includes("..") || value.includes("\\")) return "";
  if (isOfficialBrandAsset(value) || isLocalMediaUrl(value) || parseExternalMediaUrl(value)) return value;
  return "";
}

export function bannerIsVisible(startsAt: Date | null, endsAt: Date | null, now: number): boolean {
  if (startsAt && startsAt.getTime() > now) return false;
  if (endsAt && endsAt.getTime() < now) return false;
  return true;
}

export function parseSchedule(
  startsOn: string,
  endsOn: string,
): { ok: true; startsAt: Date | null; endsAt: Date | null } | { ok: false; message: string } {
  const startText = startsOn.trim();
  const endText = endsOn.trim();
  const startsAt = startText ? tehranDayStart(startText) : null;
  const endsAt = endText ? tehranDayEnd(endText) : null;
  if (startText && !startsAt) return { ok: false, message: "تاریخ شروع معتبر نیست." };
  if (endText && !endsAt) return { ok: false, message: "تاریخ پایان معتبر نیست." };
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false, message: "تاریخ پایان قبل از شروع است." };
  }
  return { ok: true, startsAt, endsAt };
}

export function parseSlug(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) return null;
  if (text.length < 2 || text.length > 80) return null;
  return text;
}

export function isMenuKey(value: string): value is MenuKey {
  return (MENU_KEYS as readonly string[]).includes(value);
}
