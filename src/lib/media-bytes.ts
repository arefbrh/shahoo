export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const LOCAL_IMAGE = /^\/media\/file\/[A-Za-z0-9_-]{8,80}$/;

export function sniffImage(bytes: Uint8Array): { mime: string; ext: "jpg" | "png" | "gif" | "webp" } | null {
  if (bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return { mime: "image/gif", ext: "gif" };
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (riff && webp) return { mime: "image/webp", ext: "webp" };
  return null;
}

export function isLocalMediaUrl(url: string): boolean {
  return LOCAL_IMAGE.test(url);
}

export function isShopImage(url: string): boolean {
  return url.startsWith("https://") || isLocalMediaUrl(url);
}
