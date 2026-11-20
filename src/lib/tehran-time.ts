/** Asia/Tehran civil dates. Iran has been UTC+03:30 with no DST since 2022. */

const TEHRAN = "Asia/Tehran";
const OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function tehranDayKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function tehranClock(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TEHRAN,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const second = parts.find((part) => part.type === "second")?.value ?? "";
  return `${hour}:${minute}:${second}`;
}

function civilDate(day: string): { year: number; month: number; date: number } | null {
  const match = DAY.exec(day.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, date));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== date) return null;
  return { year, month, date };
}

/** 00:00:00 Asia/Tehran, or null when the calendar day does not exist. */
export function tehranDayStart(day: string): Date | null {
  const civil = civilDate(day);
  if (!civil) return null;
  const start = new Date(Date.UTC(civil.year, civil.month - 1, civil.date) - OFFSET_MS);
  if (tehranDayKey(start) !== day.trim() || tehranClock(start) !== "00:00:00") return null;
  return start;
}

/** 23:59:59 Asia/Tehran, inclusive for coupon end checks. */
export function tehranDayEnd(day: string): Date | null {
  const start = tehranDayStart(day);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1000);
}
