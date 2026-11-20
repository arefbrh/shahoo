import { MAX_IMAGE_BYTES } from "../../lib/media-bytes.ts";
import { SessionError, requireAdmin } from "../auth/guard.ts";
import type { AppDatabase } from "../db/client";
import { storeUploadedImage } from "./storage.ts";

export const MAX_UPLOAD_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

const TOO_LARGE = "حجم درخواست بیشتر از حد مجاز است.";

export async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; message: string }> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared.trim()) || Number(declared) > maxBytes)) {
    return { ok: false, message: TOO_LARGE };
  }
  const body = request.body;
  if (!body) return { ok: false, message: "فایل تصویر انتخاب نشده است." };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, message: TOO_LARGE };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { ok: false, message: "خواندن فایل انجام نشد." };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

type UploadSession = { db: AppDatabase; admin: { id: string } };

export async function handleMediaUpload(
  request: Request,
  authorize: () => Promise<UploadSession> = () => requireAdmin("content.write"),
): Promise<Response> {
  let session: UploadSession;
  try {
    session = await authorize();
  } catch (error) {
    if (error instanceof SessionError) {
      const denied = error.message.includes("نقش");
      return Response.json({ ok: false, message: error.message }, { status: denied ? 403 : 401 });
    }
    return Response.json({ ok: false, message: "بارگذاری انجام نشد." }, { status: 400 });
  }
  const bounded = await readBoundedBody(request, MAX_UPLOAD_BYTES);
  if (!bounded.ok) return Response.json({ ok: false, message: bounded.message }, { status: 413 });
  let form: FormData;
  try {
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    const copy = new ArrayBuffer(bounded.bytes.byteLength);
    new Uint8Array(copy).set(bounded.bytes);
    form = await new Request(request.url, { method: "POST", headers, body: new Blob([copy]) }).formData();
  } catch {
    return Response.json({ ok: false, message: "فایل تصویر انتخاب نشده است." }, { status: 400 });
  }
  const file = form.get("file");
  const alt = String(form.get("alt") ?? "");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, message: "فایل تصویر انتخاب نشده است." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return Response.json({ ok: false, message: "حجم تصویر بیشتر از ۴ مگابایت است." }, { status: 400 });
  }
  const result = await storeUploadedImage(session.db, session.admin.id, bytes, alt);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
