/**
 * Admin media upload client rules (Batch 03). Pure: `fetch` is injected.
 * The server stays the authority on type, size and content; these checks only
 * give an immediate, understandable Persian message.
 */
import { MAX_IMAGE_BYTES } from "./media-bytes.ts";

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/gif"] as const;

export const UPLOAD_MESSAGES = {
  none: "ابتدا یک فایل تصویر انتخاب کنید.",
  type: "فقط تصویر JPEG، PNG یا GIF پذیرفته می‌شود. پشتیبانی WebP پس از افزودن decoder امن فعال می‌شود.",
  size: "حجم تصویر بیشتر از ۴ مگابایت است.",
  empty: "فایل انتخاب‌شده خالی است.",
  failed: "بارگذاری انجام نشد. اتصال را بررسی کنید و دوباره تلاش کنید.",
  badReply: "پاسخ سرور خوانده نشد. تصویر ذخیره‌شده فرض نشد؛ فهرست را تازه کنید یا دوباره بارگذاری کنید.",
} as const;

export function validateUploadFile(file: { type: string; size: number } | null | undefined): string | null {
  if (!file) return UPLOAD_MESSAGES.none;
  if (file.size === 0) return UPLOAD_MESSAGES.empty;
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) return UPLOAD_MESSAGES.type;
  if (file.size > MAX_IMAGE_BYTES) return UPLOAD_MESSAGES.size;
  return null;
}

export type UploadResult = { ok: true } | { ok: false; message: string };

type FetchLike = (url: string, init: { method: string; body: unknown }) => Promise<{ json(): Promise<unknown> }>;

/**
 * Success is reported only when the server answered `{ ok: true }`.
 * A network error, an unreadable reply or `{ ok: false }` is a failure and can be retried.
 */
export async function uploadMedia(fetchImpl: FetchLike, body: unknown): Promise<UploadResult> {
  let reply: unknown;
  try {
    const response = await fetchImpl("/api/media-upload", { method: "POST", body });
    reply = await response.json();
  } catch (error) {
    return { ok: false, message: error instanceof SyntaxError ? UPLOAD_MESSAGES.badReply : UPLOAD_MESSAGES.failed };
  }
  const parsed = reply as { ok?: unknown; message?: unknown } | null;
  if (parsed && parsed.ok === true) return { ok: true };
  const message = parsed && typeof parsed.message === "string" && parsed.message.trim() ? parsed.message : UPLOAD_MESSAGES.failed;
  return { ok: false, message };
}
