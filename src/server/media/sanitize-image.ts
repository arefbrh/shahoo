import { crc32, deflateSync, inflateSync } from "node:zlib";
import { decode as decodeJpeg, encode as encodeJpeg } from "jpeg-js";
import { MAX_IMAGE_BYTES, sniffImage } from "../../lib/media-bytes.ts";

const MAX_EDGE = 4096;
const MAX_RAW = 24 * 1024 * 1024;

export type CleanImage = { mime: string; ext: "jpg" | "png" | "gif"; bytes: Uint8Array };

/** Rebuild accepted images. JPEG/PNG pixels are decoded and rebuilt; GIF is structurally parsed and LZW-checked. WebP is rejected until a real decoder/encoder is installed. */
export function sanitizeImage(bytes: Uint8Array): CleanImage | null {
  const sniffed = sniffImage(bytes);
  if (!sniffed) return null;
  if (sniffed.ext === "jpg") return sanitizeJpeg(bytes);
  if (sniffed.ext === "png") return sanitizePng(bytes);
  if (sniffed.ext === "gif") return sanitizeGif(bytes);
  // Chunk metadata alone does not validate WebP pixel data. Fail closed instead
  // of storing an un-decoded image that could exploit downstream consumers.
  return null;
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32be(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function edgeOk(width: number, height: number): boolean {
  return width >= 1 && height >= 1 && width <= MAX_EDGE && height <= MAX_EDGE;
}

function rebuildJpeg(bytes: Uint8Array): { width: number; height: number; bytes: Uint8Array } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  let sawSof = false;
  let sawSos = false;
  let width = 0;
  let height = 0;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    while (i < bytes.length && bytes[i] === 0xff) i += 1;
    if (i >= bytes.length) return null;
    const marker = bytes[i];
    i += 1;
    if (marker === 0xd9) {
      if (!sawSof || !sawSos || !edgeOk(width, height)) return null;
      out.push(0xff, 0xd9);
      return { width, height, bytes: Uint8Array.from(out) };
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      continue;
    }
    if (i + 1 >= bytes.length) return null;
    const len = u16(bytes, i);
    if (len < 2 || i + len > bytes.length) return null;
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) {
      if (len < 8 || bytes[i + 2] !== 8) return null;
      height = u16(bytes, i + 3);
      width = u16(bytes, i + 5);
      if (!edgeOk(width, height)) return null;
      sawSof = true;
    }
    const drop = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (marker === 0xda) {
      sawSos = true;
      out.push(0xff, marker);
      for (let k = 0; k < len; k += 1) out.push(bytes[i + k]);
      i += len;
      while (i < bytes.length) {
        if (bytes[i] !== 0xff) {
          out.push(bytes[i]);
          i += 1;
          continue;
        }
        const next = bytes[i + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          out.push(0xff, next);
          i += 2;
          continue;
        }
        if (next === 0xff) {
          i += 1;
          continue;
        }
        if (next === 0xd9) {
          if (!sawSof || !edgeOk(width, height)) return null;
          out.push(0xff, 0xd9);
          return { width, height, bytes: Uint8Array.from(out) };
        }
        return null;
      }
      return null;
    }
    if (!drop) {
      out.push(0xff, marker);
      for (let k = 0; k < len; k += 1) out.push(bytes[i + k]);
    }
    i += len;
  }
  return null;
}

function sanitizeJpeg(bytes: Uint8Array): CleanImage | null {
  const parsed = rebuildJpeg(bytes);
  if (!parsed) return null;
  if (parsed.width * parsed.height * 4 > MAX_RAW) return null;
  try {
    const decoded = decodeJpeg(parsed.bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxMemoryUsageInMB: 32,
      maxResolutionInMP: 16,
    });
    if (decoded.width !== parsed.width || decoded.height !== parsed.height) return null;
    if (decoded.data.length < decoded.width * decoded.height * 4) return null;
    const encoded = encodeJpeg({ data: decoded.data, width: decoded.width, height: decoded.height }, 90);
    if (encoded.data.length < 12 || encoded.data.length > MAX_IMAGE_BYTES) return null;
    const again = rebuildJpeg(encoded.data);
    if (!again || again.width !== decoded.width || again.height !== decoded.height) return null;
    return { mime: "image/jpeg", ext: "jpg", bytes: again.bytes };
  } catch {
    return null;
  }
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0);
  return Buffer.concat([head, name, data, sum]);
}

function paeth(left: number, up: number, ul: number): number {
  const estimate = left + up - ul;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const diagonal = Math.abs(estimate - ul);
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left;
  if (upDistance <= diagonal) return up;
  return ul;
}

function unfilterPng(raw: Buffer, height: number, stride: number, bpp: number): Buffer | null {
  if (stride < 2 || height < 1 || raw.length !== stride * height) return null;
  const out = Buffer.alloc(raw.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    const filter = raw[row];
    if (filter > 4) return null;
    out[row] = 0;
    for (let x = 1; x < stride; x += 1) {
      const index = row + x;
      const left = x > bpp ? out[index - bpp] : 0;
      const up = y > 0 ? out[index - stride] : 0;
      const diagonal = y > 0 && x > bpp ? out[index - stride - bpp] : 0;
      const value = raw[index];
      if (filter === 0) out[index] = value;
      else if (filter === 1) out[index] = (value + left) & 255;
      else if (filter === 2) out[index] = (value + up) & 255;
      else if (filter === 3) out[index] = (value + Math.floor((left + up) / 2)) & 255;
      else out[index] = (value + paeth(left, up, diagonal)) & 255;
    }
  }
  return out;
}

function sanitizePng(bytes: Uint8Array): CleanImage | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i += 1) if (bytes[i] !== sig[i]) return null;
  let offset = 8;
  const kept: Buffer[] = [];
  const idat: Buffer[] = [];
  let sawHeader = false;
  let sawEnd = false;
  let sawPalette = false;
  let colorType = -1;
  let imageHeight = 0;
  let headerRow = 0;
  let headerBpp = 1;
  while (offset + 12 <= bytes.length) {
    const len = u32be(bytes, offset);
    if (offset + 12 + len > bytes.length) return null;
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8));
    const data = Buffer.from(bytes.subarray(offset + 8, offset + 8 + len));
    const actual = u32be(bytes, offset + 8 + len);
    if ((crc32(Buffer.concat([type, data])) >>> 0) !== actual) return null;
    const name = type.toString("ascii");
    if (!sawHeader && name !== "IHDR") return null;
    if (name === "IHDR") {
      if (sawHeader || len !== 13) return null;
      const width = data.readUInt32BE(0);
      const height = data.readUInt32BE(4);
      const depth = data[8];
      const color = data[9];
      const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number | undefined>)[color];
      if (!channels || data[10] !== 0 || data[11] !== 0 || data[12] > 1) return null;
      if (![1, 2, 4, 8, 16].includes(depth) || !edgeOk(width, height) || data[12] !== 0) return null;
      const row = 1 + Math.ceil((width * channels * depth) / 8);
      if (row * height > MAX_RAW) return null;
      sawHeader = true;
      colorType = color;
      imageHeight = height;
      kept.push(pngChunk("IHDR", data));
      headerRow = row;
      headerBpp = Math.max(1, Math.ceil((channels * depth) / 8));
    } else if (name === "PLTE" || name === "tRNS") {
      if (name === "PLTE") sawPalette = true;
      kept.push(pngChunk(name, data));
    } else if (name === "IDAT") {
      if (colorType === 3 && !sawPalette) return null;
      idat.push(data);
    } else if (name === "IEND") {
      sawEnd = true;
      break;
    } else if (name[0] !== name[0].toLowerCase()) {
      return null;
    }
    offset += 12 + len;
  }
  if (!sawHeader || !sawEnd || idat.length === 0 || (colorType === 3 && !sawPalette)) return null;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: MAX_RAW });
  } catch {
    return null;
  }
  const plain = unfilterPng(raw, imageHeight, headerRow, headerBpp);
  if (!plain) return null;
  const body = Buffer.concat([Buffer.from(sig), ...kept, pngChunk("IDAT", deflateSync(plain)), pngChunk("IEND", Buffer.alloc(0))]);
  return { mime: "image/png", ext: "png", bytes: new Uint8Array(body) };
}

function gifLzwOk(minCodeSize: number, data: Uint8Array, expectedPixels: number): boolean {
  if (minCodeSize < 2 || minCodeSize > 8 || data.length === 0 || expectedPixels < 1) return false;
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = end + 1;
  const dict: Array<{ first: number; length: number } | undefined> = [];
  const reset = () => {
    dict.length = 0;
    for (let index = 0; index < clear; index += 1) dict[index] = { first: index, length: 1 };
  };
  reset();
  let previous: { first: number; length: number } | null = null;
  let decodedPixels = 0;
  let buffer = 0;
  let bits = 0;
  let cursor = 0;
  const readCode = (): number => {
    while (bits < codeSize) {
      if (cursor >= data.length) return -1;
      buffer |= data[cursor]! << bits;
      bits += 8;
      cursor += 1;
    }
    const code = buffer & ((1 << codeSize) - 1);
    buffer >>= codeSize;
    bits -= codeSize;
    return code;
  };
  while (true) {
    const code = readCode();
    if (code < 0) return false;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = end + 1;
      reset();
      previous = null;
      continue;
    }
    if (code === end) return decodedPixels === expectedPixels;
    let entry = code < next ? dict[code] : undefined;
    if (!entry && code === next && previous) entry = { first: previous.first, length: previous.length + 1 };
    if (!entry) return false;
    decodedPixels += entry.length;
    if (decodedPixels > expectedPixels) return false;
    if (previous && next < 4096) {
      dict[next] = { first: previous.first, length: previous.length + entry.length };
      next += 1;
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
    }
    previous = entry;
  }
}

function sanitizeGif(bytes: Uint8Array): CleanImage | null {
  if (bytes.length < 13) return null;
  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  const width = bytes[6]! | (bytes[7]! << 8);
  const height = bytes[8]! | (bytes[9]! << 8);
  if (!edgeOk(width, height) || width * height > MAX_RAW) return null;
  let i = 13;
  const hasGlobalPalette = (bytes[10]! & 0x80) !== 0;
  if (hasGlobalPalette) {
    const size = 3 * (1 << ((bytes[10]! & 7) + 1));
    if (i + size > bytes.length) return null;
    i += size;
  }
  const skipBlocks = (): boolean => {
    while (i < bytes.length) {
      const count = bytes[i]!;
      i += 1;
      if (count === 0) return true;
      if (i + count > bytes.length) return false;
      i += count;
    }
    return false;
  };
  let frameCount = 0;
  let totalPixels = 0;
  while (i < bytes.length) {
    const block = bytes[i]!;
    i += 1;
    if (block === 0x3b) {
      if (frameCount === 0) return null;
      return { mime: "image/gif", ext: "gif", bytes: bytes.slice(0, i) };
    }
    if (block === 0x21) {
      if (i >= bytes.length) return null;
      i += 1;
      if (!skipBlocks()) return null;
      continue;
    }
    if (block === 0x2c) {
      if (i + 9 > bytes.length) return null;
      const left = bytes[i]! | (bytes[i + 1]! << 8);
      const top = bytes[i + 2]! | (bytes[i + 3]! << 8);
      const frameWidth = bytes[i + 4]! | (bytes[i + 5]! << 8);
      const frameHeight = bytes[i + 6]! | (bytes[i + 7]! << 8);
      const local = bytes[i + 8]!;
      i += 9;
      if (!frameWidth || !frameHeight || left + frameWidth > width || top + frameHeight > height) return null;
      const pixels = frameWidth * frameHeight;
      totalPixels += pixels;
      frameCount += 1;
      if (frameCount > 100 || totalPixels > MAX_RAW) return null;
      const hasLocalPalette = (local & 0x80) !== 0;
      if (hasLocalPalette) {
        const size = 3 * (1 << ((local & 7) + 1));
        if (i + size > bytes.length) return null;
        i += size;
      } else if (!hasGlobalPalette) return null;
      if (i >= bytes.length) return null;
      const minCode = bytes[i]!;
      i += 1;
      const packed: number[] = [];
      let ended = false;
      while (i < bytes.length) {
        const count = bytes[i]!;
        i += 1;
        if (count === 0) {
          ended = true;
          break;
        }
        if (i + count > bytes.length) return null;
        for (let offset = 0; offset < count; offset += 1) packed.push(bytes[i + offset]!);
        i += count;
      }
      if (!ended || !gifLzwOk(minCode, Uint8Array.from(packed), pixels)) return null;
      continue;
    }
    return null;
  }
  return null;
}
