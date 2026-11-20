import type { StoreProfile } from "./store-types";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Exact sample strings previously written by the baseline seed. They are not deleted from old databases, but they are not shown as real contact details. */
const SEEDED_CONTACT = new Set([
  "02112345678",
  "09121234567",
  "info@shahoo-organic.ir",
  "@shahoo.organic",
  "@shahoo_organic",
  "shahoo.organic",
  "shahoo_organic",
]);

const SEEDED_STORY_ABOUT = "برند شاهو با الهام از کوهستان شاهو";
const SEEDED_STORY_PHILOSOPHY = "طبیعت بهترین کیفیت را در سادگی می‌دهد.";

export const SEEDED_PROMO = "ارسال برای خریدهای بالای یک و نیم میلیون تومان با پست پیشتاز";

export type PublicContact = {
  key: "phone" | "email" | "address" | "whatsapp" | "instagram" | "telegram";
  label: string;
  text: string;
  href: string | null;
};

export type ProfileContactInput = {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  instagram: string;
  telegram: string;
};

export function foldDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (persian >= 0) return String(persian);
    const arabic = ARABIC_DIGITS.indexOf(char);
    return arabic >= 0 ? String(arabic) : char;
  });
}

function compact(value: string): string {
  return foldDigits(value).replace(/[\s\-_.]/g, "").trim().toLowerCase();
}

export function isSuppressedContact(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  if (!text) return true;
  const folded = foldDigits(text).replace(/\s+/g, " ").trim().toLowerCase();
  if (SEEDED_CONTACT.has(folded) || SEEDED_CONTACT.has(compact(text))) return true;
  if (folded.includes("زعفرانیه") && folded.includes("اردبیلی")) return true;
  return false;
}

function publishPhone(value: string): string | null {
  if (isSuppressedContact(value)) return null;
  const digits = foldDigits(value).replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  if (digits.includes("1234567")) return null;
  return digits;
}

function publishEmail(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (!text || isSuppressedContact(text)) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(text)) return null;
  return text;
}

function publishAddress(value: string): string | null {
  const text = value.trim();
  if (text.length < 8 || text.length > 300) return null;
  if (isSuppressedContact(text)) return null;
  return text;
}

function publishHandle(value: string): string | null {
  const text = value.trim();
  if (isSuppressedContact(text)) return null;
  if (!/^@?[A-Za-z0-9._]{2,40}$/.test(text)) return null;
  return text.startsWith("@") ? text : `@${text}`;
}

/** Rows the public site may render. Empty, invalid, and known sample values are omitted. */
export function contactRows(profile: Pick<StoreProfile, "phone" | "email" | "address" | "whatsapp" | "instagram" | "telegram">): PublicContact[] {
  const rows: PublicContact[] = [];
  const phone = publishPhone(profile.phone);
  if (phone) rows.push({ key: "phone", label: "تلفن", text: profile.phone.trim(), href: `tel:${phone}` });
  const email = publishEmail(profile.email);
  if (email) rows.push({ key: "email", label: "ایمیل", text: email, href: `mailto:${email}` });
  const address = publishAddress(profile.address);
  if (address) rows.push({ key: "address", label: "نشانی", text: address, href: null });
  const whatsapp = publishPhone(profile.whatsapp);
  if (whatsapp) {
    const international = whatsapp.replace(/^0/, "98");
    rows.push({ key: "whatsapp", label: "واتساپ", text: profile.whatsapp.trim(), href: `https://wa.me/${international}` });
  }
  const instagram = publishHandle(profile.instagram);
  if (instagram) {
    rows.push({
      key: "instagram",
      label: "اینستاگرام",
      text: instagram,
      href: `https://instagram.com/${encodeURIComponent(instagram.slice(1))}`,
    });
  }
  const telegram = publishHandle(profile.telegram);
  if (telegram) {
    rows.push({
      key: "telegram",
      label: "تلگرام",
      text: telegram,
      href: `https://t.me/${encodeURIComponent(telegram.slice(1))}`,
    });
  }
  return rows;
}

export function publicPromo(text: string | null | undefined): string {
  const value = (text ?? "").trim();
  if (!value || value === SEEDED_PROMO) return "";
  return value;
}

/** Blank, and the previous invented baseline story, are not treated as a verified brand statement. */
export function storyIsConfigured(story: { title?: string; about?: string; philosophy?: string } | null | undefined): boolean {
  if (!story) return false;
  const title = (story.title ?? "").trim();
  const about = (story.about ?? "").trim();
  const philosophy = (story.philosophy ?? "").trim();
  if (!title && !about && !philosophy) return false;
  if (about.startsWith(SEEDED_STORY_ABOUT) && philosophy.startsWith(SEEDED_STORY_PHILOSOPHY)) return false;
  return true;
}

function optionalField(
  value: string,
  publish: (value: string) => string | null,
  label: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const text = value.trim();
  if (!text) return { ok: true, value: "" };
  if (!publish(text)) return { ok: false, message: `${label} معتبر نیست یا هنوز فقط مقدار نمونه است.` };
  return { ok: true, value: text };
}

export function parseProfileContact(
  input: ProfileContactInput,
): { ok: true; value: ProfileContactInput } | { ok: false; message: string } {
  const phone = optionalField(input.phone, publishPhone, "تلفن");
  if (!phone.ok) return phone;
  const whatsapp = optionalField(input.whatsapp, publishPhone, "واتساپ");
  if (!whatsapp.ok) return whatsapp;
  const email = optionalField(input.email, publishEmail, "ایمیل");
  if (!email.ok) return email;
  const address = optionalField(input.address, publishAddress, "نشانی");
  if (!address.ok) return address;
  const instagram = optionalField(input.instagram, publishHandle, "اینستاگرام");
  if (!instagram.ok) return instagram;
  const telegram = optionalField(input.telegram, publishHandle, "تلگرام");
  if (!telegram.ok) return telegram;
  return {
    ok: true,
    value: {
      phone: phone.value,
      whatsapp: whatsapp.value,
      email: email.value,
      address: address.value,
      instagram: instagram.value,
      telegram: telegram.value,
    },
  };
}
