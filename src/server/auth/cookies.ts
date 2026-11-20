import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

export const CUSTOMER_COOKIE = "shahoo_customer";
export const ADMIN_COOKIE = "shahoo_admin";
export const CART_COOKIE = "shahoo_cart";
export const RECEIPT_COOKIE = "shahoo_receipts";

const CART_MAX_AGE = 60 * 60 * 24 * 30;

function secureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

export function readSessionCookie(name: string): string | null {
  const value = getCookie(name);
  if (!value || value.length < 20) return null;
  return value;
}

export function writeSessionCookie(name: string, token: string, maxAgeSec: number): void {
  setCookie(name, token, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  });
}

export function clearSessionCookie(name: string): void {
  deleteCookie(name, {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
  });
}

export function readCartToken(): string | null {
  return readSessionCookie(CART_COOKIE);
}

export function writeCartToken(token: string): void {
  writeSessionCookie(CART_COOKIE, token, CART_MAX_AGE);
}

export function clearCartToken(): void {
  clearSessionCookie(CART_COOKIE);
}

export function readReceiptPairs(): Array<{ publicCode: string; token: string }> {
  const raw = getCookie(RECEIPT_COOKIE);
  if (!raw) return [];
  const pairs: Array<{ publicCode: string; token: string }> = [];
  for (const part of raw.split("~")) {
    const dot = part.indexOf(".");
    if (dot < 4) continue;
    const publicCode = part.slice(0, dot);
    const token = part.slice(dot + 1);
    if (!publicCode.startsWith("SH-") || token.length < 20) continue;
    pairs.push({ publicCode, token });
  }
  return pairs;
}

export function readReceiptToken(publicCode: string): string | null {
  return readReceiptPairs().find((pair) => pair.publicCode === publicCode)?.token ?? null;
}

export function rememberReceipt(publicCode: string, token: string): void {
  const kept = readReceiptPairs().filter((pair) => pair.publicCode !== publicCode);
  kept.push({ publicCode, token });
  const value = kept
    .slice(-12)
    .map((pair) => `${pair.publicCode}.${pair.token}`)
    .join("~");
  writeSessionCookie(RECEIPT_COOKIE, value, CART_MAX_AGE);
}
