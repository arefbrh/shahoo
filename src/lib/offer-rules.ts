import { tehranDayEnd, tehranDayKey, tehranDayStart } from "./tehran-time.ts";

const RIALS_PER_TOMAN = 10;

export type CouponDraft = {
  code: string;
  description: string;
  mode: "percent" | "amount";
  percent: number | null;
  amountToman: number | null;
  minSubtotalToman: number;
  usageLimit: number | null;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

export type ParsedCoupon = {
  code: string;
  description: string;
  percentOff: number | null;
  amountOffIrr: number | null;
  minSubtotalIrr: number;
  usageLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

export type ShippingDraft = {
  province?: string;
  city?: string;
  key: string;
  title: string;
  description: string;
  priceToman: number;
  freeOverToman: number | null;
  sortOrder: number;
  isActive: boolean;
};

export type ParsedShipping = {
  key: string;
  title: string;
  description: string;
  priceIrr: number;
  freeOverIrr: number | null;
  sortOrder: number;
  isActive: boolean;
};

export function parseCouponDraft(input: CouponDraft): { ok: true; value: ParsedCoupon } | { ok: false; message: string } {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(code)) {
    return { ok: false, message: "کد تخفیف باید ۳ تا ۴۰ حرف انگلیسی یا عدد باشد." };
  }
  const description = clean(input.description, 0, 200);
  if (description === null) return { ok: false, message: "توضیح کد تخفیف معتبر نیست." };
  let percentOff: number | null = null;
  let amountOffIrr: number | null = null;
  if (input.mode === "percent") {
    if (!Number.isInteger(input.percent) || (input.percent ?? 0) < 1 || (input.percent ?? 0) > 100) {
      return { ok: false, message: "درصد تخفیف باید عدد صحیح از ۱ تا ۱۰۰ باشد." };
    }
    percentOff = input.percent;
  } else if (input.mode === "amount") {
    const amount = tomanField(input.amountToman, 1, 50_000_000, "مبلغ تخفیف");
    if (!amount.ok) return amount;
    amountOffIrr = amount.irr;
  } else {
    return { ok: false, message: "نوع تخفیف را انتخاب کنید." };
  }
  const minimum = tomanField(input.minSubtotalToman, 0, 50_000_000, "حداقل سبد");
  if (!minimum.ok) return minimum;
  let usageLimit: number | null = null;
  if (input.usageLimit !== null) {
    if (!Number.isInteger(input.usageLimit) || input.usageLimit < 1 || input.usageLimit > 100_000) {
      return { ok: false, message: "سقف استفاده باید عدد صحیح از ۱ تا ۱۰۰هزار باشد، یا خالی بماند." };
    }
    usageLimit = input.usageLimit;
  }
  const days = parseDayRange(input.startsOn, input.endsOn);
  if (!days.ok) return days;
  return {
    ok: true,
    value: {
      code,
      description,
      percentOff,
      amountOffIrr,
      minSubtotalIrr: minimum.irr,
      usageLimit,
      startsAt: days.startsAt,
      endsAt: days.endsAt,
      isActive: input.isActive,
    },
  };
}

export function parseShippingDraft(input: ShippingDraft): { ok: true; value: ParsedShipping } | { ok: false; message: string } {
  const key = input.key.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length < 2 || key.length > 40) {
    return { ok: false, message: "شناسه روش ارسال باید انگلیسی و کوتاه باشد." };
  }
  const title = clean(input.title, 2, 60);
  const description = clean(input.description, 0, 200);
  if (!title || description === null) return { ok: false, message: "عنوان روش ارسال را درست وارد کنید." };
  const price = tomanField(input.priceToman, 0, 5_000_000, "هزینه ارسال");
  if (!price.ok) return price;
  let freeOverIrr: number | null = null;
  if (input.freeOverToman !== null) {
    const free = tomanField(input.freeOverToman, 1, 50_000_000, "آستانه ارسال رایگان");
    if (!free.ok) return free;
    freeOverIrr = free.irr;
  }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 999) {
    return { ok: false, message: "ترتیب روش ارسال باید بین ۰ و ۹۹۹ باشد." };
  }
  return {
    ok: true,
    value: {
      key,
      title,
      description,
      priceIrr: price.irr,
      freeOverIrr,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
  };
}

export function canCancelUnpaid(status: string): boolean {
  return status === "awaiting_payment";
}

export function dayKey(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return tehranDayKey(date);
}

function tomanField(
  input: number | null,
  min: number,
  max: number,
  label: string,
): { ok: true; irr: number } | { ok: false; message: string } {
  if (!Number.isInteger(input) || input === null || input < min || input > max) {
    return { ok: false, message: `${label} باید عدد صحیح تومان، از ${min} تا ${max.toLocaleString("en-US")} باشد.` };
  }
  return { ok: true, irr: input * RIALS_PER_TOMAN };
}

function clean(value: string, min: number, max: number): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) return null;
  if (/[<>]/.test(text) || [...text].some((char) => char.charCodeAt(0) < 32)) return null;
  return text;
}

function parseDayRange(start: string, end: string): { ok: true; startsAt: Date | null; endsAt: Date | null } | { ok: false; message: string } {
  const startsAt = start.trim() ? dayStamp(start, false) : null;
  const endsAt = end.trim() ? dayStamp(end, true) : null;
  if (start.trim() && !startsAt) return { ok: false, message: "تاریخ شروع معتبر نیست." };
  if (end.trim() && !endsAt) return { ok: false, message: "تاریخ پایان معتبر نیست." };
  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    return { ok: false, message: "تاریخ پایان باید بعد از شروع باشد." };
  }
  return { ok: true, startsAt, endsAt };
}

function dayStamp(value: string, endOfDay: boolean): Date | null {
  return endOfDay ? tehranDayEnd(value) : tehranDayStart(value);
}
