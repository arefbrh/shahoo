import { irrToToman } from "./money";

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianNum(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function formatTomanFromIrr(irr: number): string {
  const toman = irrToToman(irr);
  return `${toPersianNum(toman.toLocaleString("en-US"))} تومان`;
}
