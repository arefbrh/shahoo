import { IRAN_PROVINCES } from "./iran-provinces.ts";
import { hasUnsafeText } from "./text-safety.ts";

type AddressInput = {
  label: string;
  recipientName: string;
  recipientMobile: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  plaque: string;
  unit: string;
};

export type AddressValue = Omit<AddressInput, "recipientMobile"> & { recipientMobile: string };

function clean(value: string, min: number, max: number): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) return null;
  if (hasUnsafeText(text)) return null;
  return text;
}

function digits(value: string): string {
  return value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\D/g, "");
}

export function parseAddress(input: AddressInput): { ok: true; value: AddressValue } | { ok: false; message: string } {
  const label = input.label.trim() ? clean(input.label, 1, 40) : "";
  const recipientName = clean(input.recipientName, 2, 80);
  const recipientMobile = digits(input.recipientMobile);
  const city = clean(input.city, 2, 40);
  const addressLine = clean(input.addressLine, 8, 300);
  const postalCode = digits(input.postalCode);
  const plaque = input.plaque.trim() ? clean(input.plaque, 1, 20) : "";
  const unit = input.unit.trim() ? clean(input.unit, 1, 20) : "";
  if (input.label.trim() && label === null) return { ok: false, message: "برچسب نشانی معتبر نیست." };
  if (!recipientName) return { ok: false, message: "نام گیرنده را کامل بنویسید." };
  if (!/^09\d{9}$/.test(recipientMobile)) return { ok: false, message: "شماره موبایل گیرنده باید با ۰۹ و ۱۱ رقم وارد شود." };
  if (!(IRAN_PROVINCES as readonly string[]).includes(input.province)) return { ok: false, message: "استان را از فهرست انتخاب کنید." };
  if (!city) return { ok: false, message: "شهر را بنویسید." };
  if (!addressLine) return { ok: false, message: "نشانی را کامل‌تر بنویسید." };
  if (!/^\d{10}$/.test(postalCode)) return { ok: false, message: "کد پستی باید ۱۰ رقم باشد." };
  if (input.plaque.trim() && plaque === null) return { ok: false, message: "پلاک معتبر نیست." };
  if (input.unit.trim() && unit === null) return { ok: false, message: "واحد معتبر نیست." };
  return {
    ok: true,
    value: {
      label: label ?? "",
      recipientName,
      recipientMobile,
      province: input.province,
      city,
      addressLine,
      postalCode,
      plaque: plaque ?? "",
      unit: unit ?? "",
    },
  };
}
