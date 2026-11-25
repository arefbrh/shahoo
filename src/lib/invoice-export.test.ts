import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceSheetXml, sanitizeSpreadsheetText } from "./invoice-export.ts";

test("XLSX text sanitizer escapes XML and neutralizes formula prefixes", () => {
  assert.equal(sanitizeSpreadsheetText("نام عادی"), "نام عادی");
  assert.equal(sanitizeSpreadsheetText("<tag>&\"'"), "&lt;tag&gt;&amp;&quot;&apos;");
  assert.equal(sanitizeSpreadsheetText("=1+1"), "&apos;=1+1");
  assert.equal(sanitizeSpreadsheetText("+989120000000"), "&apos;+989120000000");
  assert.equal(sanitizeSpreadsheetText("-50000"), "&apos;-50000");
  assert.equal(sanitizeSpreadsheetText("@formula"), "&apos;@formula");
  assert.equal(sanitizeSpreadsheetText("  =1+1"), "&apos;  =1+1");
});

test("invoice worksheet emits every line and sanitizes untrusted customer/product text", () => {
  const lines = Array.from({ length: 12 }, (_, index) => ({
    id: `line-${index + 1}`,
    name: index === 0 ? "=HYPERLINK(\"https://example.test\")" : `محصول ${index + 1}`,
    label: "+500ml",
    sku: `SKU-${index + 1}`,
    quantity: 1,
    unitPriceIrr: 100_000,
    lineTotalIrr: 100_000,
  }));
  const order = {
    publicCode: "SH-TEST",
    createdAtLabel: "۱۴۰۵/۰۹/۰۳",
    fullName: "@customer",
    mobile: "+989120000000",
    province: "تهران",
    city: "تهران",
    addressLine: "نشانی",
    postalCode: "1234567890",
    plaque: "1",
    unit: "2",
    customerNote: "=malicious",
    lines,
    subtotalIrr: 1_200_000,
    discountIrr: 0,
    shippingIrr: 0,
    totalIrr: 1_200_000,
  } as never;

  const xml = buildInvoiceSheetXml(order);
  assert.ok(xml.includes("&apos;=HYPERLINK"));
  assert.ok(xml.includes("&apos;@customer"));
  assert.ok(xml.includes("&apos;=malicious"));
  assert.ok(xml.includes("SKU-12"));
  assert.ok(xml.includes("<row r=\"20\">"));
});
