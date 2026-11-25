import type { OrderView } from "@/lib/commerce-types";

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value / 10)) + " تومان";
const dateName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "-");

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; body: string }>) {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => [v & 255, (v >>> 8) & 255];
  const u32 = (v: number) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.body);
    const crc = crc32(data);
    const header = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
    ]);
    local.push(header, name, data);
    const directory = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]);
    central.push(directory, name);
    offset += header.length + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);
  const parts = [...local, ...central, end].map((part) => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer);
  return new Blob(parts, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function xml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function sanitizeSpreadsheetText(value: unknown): string {
  const str = String(value ?? "");
  // Mitigation for Formula Injection: prefix leading formula characters with an apostrophe
  const firstSignificant = Array.from(str).find((char) => char.charCodeAt(0) > 0x1f && !/\s/.test(char));
  const safe = firstSignificant !== undefined && "=+-@".includes(firstSignificant) ? `'${str}` : str;
  return xml(safe);
}

export function buildInvoiceSheetXml(order: OrderView): string {
  const rows: Array<Array<string | number>> = [
    ["SHAHOO", "فاکتور فروش", order.publicCode],
    ["تاریخ صدور", order.createdAtLabel],
    ["خریدار", order.fullName],
    ["موبایل", order.mobile],
    ["نشانی", [order.province, order.city, order.addressLine, order.plaque ? `پلاک ${order.plaque}` : "", order.unit ? `واحد ${order.unit}` : ""].filter(Boolean).join("، ")],
    ["کد پستی", order.postalCode],
    [],
    ["ردیف", "شرح کالا", "شناسه / تنوع", "تعداد", "مبلغ واحد (ریال)", "مبلغ کل (ریال)"],
    ...order.lines.map((line, index) => [index + 1, line.name, [line.sku, line.label].filter(Boolean).join(" · "), line.quantity, line.unitPriceIrr, line.lineTotalIrr]),
    [],
    ["جمع کالاها (ریال)", order.subtotalIrr],
    ["تخفیف (ریال)", order.discountIrr],
    ["هزینه ارسال (ریال)", order.shippingIrr],
    ["مبلغ قابل پرداخت (ریال)", order.totalIrr],
    ["توضیحات مشتری", order.customerNote || "—"],
  ];
  const sheetRows = rows.map((row, index) => {
    const cells = row.map((value, col) => {
      const ref = (n: number) => { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
      const cellRef = `${ref(col + 1)}${index + 1}`;
      return typeof value === "number"
        ? `<c r="${cellRef}" t="n"><v>${value}</v></c>`
        : `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${sanitizeSpreadsheetText(value)}</t></is></c>`;
    }).join("");
    return `<row r="${index + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="22"/><sheetData>${sheetRows}</sheetData><autoFilter ref="A8:F${7 + order.lines.length + 1}"/></worksheet>`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadInvoiceXlsx(order: OrderView) {
  const sheet1Xml = buildInvoiceSheetXml(order);
  const files = [
    { name: "[Content_Types].xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: "_rels/.rels", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: "xl/workbook.xml", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="فاکتور" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: "xl/_rels/workbook.xml.rels", body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: "xl/worksheets/sheet1.xml", body: sheet1Xml },
  ];
  download(zipStore(files), `SHAHOO-invoice-${dateName(order.publicCode)}.xlsx`);
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 24, bold = false, align: CanvasTextAlign = "right") {
  ctx.font = `${bold ? "700" : "400"} ${size}px Vazirmatn, Tahoma, sans-serif`;
  ctx.textAlign = align;
  ctx.direction = "rtl";
  ctx.fillStyle = "#29291f";
  ctx.fillText(text, x, y, 900);
}

export async function downloadInvoicePng(order: OrderView) {
  await document.fonts.ready;
  const pageSize = 14;
  const pages = Math.max(1, Math.ceil(order.lines.length / pageSize));
  const logo = new Image();
  logo.src = "/assets/brand/shahoo-logo-minimal.jpg";
  try {
    await logo.decode();
  } catch {
    logo.src = "/assets/brand/shahoo-logo-minimal.png";
    try { await logo.decode(); } catch { /* Keep a text-only brand mark if the optional logo is unavailable. */ }
  }
  for (let page = 0; page < pages; page++) {
    const start = page * pageSize;
    const lines = order.lines.slice(start, start + pageSize);
    const isLast = page === pages - 1;
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = isLast ? 1900 : 1650;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("امکان ساخت تصویر فاکتور وجود ندارد.");
    ctx.fillStyle = "#fffdf8"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#b69755"; ctx.lineWidth = 5; ctx.strokeRect(35, 35, 1530, canvas.height - 70);
    if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, 1320, 75, 170, 170);
    drawText(ctx, "SHAHOO", 1270, 150, 44, true);
    drawText(ctx, "فاکتور فروش", 1490, 300, 42, true);
    drawText(ctx, `شماره فاکتور: ${order.publicCode}`, 1490, 365, 25, true);
    drawText(ctx, `تاریخ صدور: ${order.createdAtLabel}`, 770, 365, 25);
    if (page === 0) {
      drawText(ctx, `خریدار: ${order.fullName}`, 1490, 455, 23, true);
      drawText(ctx, `تلفن: ${order.mobile}`, 1490, 505, 22);
      drawText(ctx, `نشانی: ${[order.province, order.city, order.addressLine, order.plaque ? `پلاک ${order.plaque}` : "", order.unit ? `واحد ${order.unit}` : ""].filter(Boolean).join("، ")}`, 1490, 555, 19);
      drawText(ctx, `کد پستی: ${order.postalCode || "—"}`, 1490, 605, 21);
    }
    const top = page === 0 ? 690 : 470;
    const col = [1490, 1320, 850, 590, 390, 150];
    ctx.fillStyle = "#173d28"; ctx.fillRect(95, top - 48, 1410, 58);
    ["ردیف", "شرح کالا", "شناسه / تنوع", "تعداد", "مبلغ واحد", "مبلغ کل"].forEach((label, i) => drawText(ctx, label, col[i], top - 10, 19, true, "right"));
    lines.forEach((line, i) => {
      const y = top + 55 + i * 58;
      ctx.fillStyle = i % 2 ? "#f5eedf" : "#fffdf8"; ctx.fillRect(95, y - 35, 1410, 52);
      const values = [String(start + i + 1), line.name, [line.sku, line.label].filter(Boolean).join(" · ") || "—", String(line.quantity), money(line.unitPriceIrr), money(line.lineTotalIrr)];
      values.forEach((value, j) => drawText(ctx, value, col[j], y, j === 1 ? 18 : 16, j === 1));
    });
    if (isLast) {
      const y = top + 55 + lines.length * 58 + 60;
      drawText(ctx, `جمع کالاها: ${money(order.subtotalIrr)}`, 1490, y, 22, true);
      drawText(ctx, `تخفیف: ${money(order.discountIrr)}`, 1490, y + 50, 22);
      drawText(ctx, `هزینه ارسال: ${money(order.shippingIrr)}`, 1490, y + 100, 22);
      drawText(ctx, `مبلغ قابل پرداخت: ${money(order.totalIrr)}`, 1490, y + 165, 30, true);
      drawText(ctx, "از خرید شما سپاسگزاریم", 800, canvas.height - 100, 24, true, "center");
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("ساخت PNG ناموفق بود.")), "image/png"));
    download(blob, `SHAHOO-invoice-${dateName(order.publicCode)}-${page + 1}-of-${pages}.png`);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  }
}
