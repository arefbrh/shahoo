import test from "node:test";
import assert from "node:assert/strict";

import { resolveCarrierTracking } from "../src/lib/carrier-tracking.ts";
import { DEFAULT_PRODUCT_FAQS, DEFAULT_TRUST_MARKS } from "../src/lib/cms-defaults.ts";
import { isLineSellable, combinedCartQuantity } from "../src/lib/commerce-integrity.ts";
import { formatTomanFromIrr, irrToToman, toPersianNum } from "../src/lib/format.ts";
import { IRAN_PROVINCES, getCitiesForProvince, isValidCityForProvince } from "../src/lib/iran-cities.ts";
import { buildInvoiceSheetXml, sanitizeSpreadsheetText } from "../src/lib/invoice-export.ts";
import { localStorageAllowed, openStorage, objectNameForStorageKey, localObjectName } from "../src/server/media/disk.ts";
import { resolveDatabasePlan, isProductionEnv, migrationGuard, otpEchoAllowed, mockPaymentAllowed } from "../src/server/env/runtime.ts";

test("Remediation Suite 1: Storage Provider and S3 Variables Parity", () => {
  // Alias disk -> local
  assert.equal(localStorageAllowed({ NODE_ENV: "development", STORAGE_PROVIDER: "disk" }), true);
  assert.equal(localStorageAllowed({ NODE_ENV: "development", STORAGE_PROVIDER: "local" }), true);
  // Production enforcement
  assert.equal(localStorageAllowed({ NODE_ENV: "production", STORAGE_PROVIDER: "disk" }), false);
  assert.equal(localStorageAllowed({ NODE_ENV: "production", STORAGE_PROVIDER: "disk", ALLOW_LOCAL_STORAGE: "true" }), true);
  assert.equal(localStorageAllowed({ NODE_ENV: "production", STORAGE_PROVIDER: "local", ALLOW_LOCAL_STORAGE: "1" }), true);

  // S3 dual variable resolution
  const modern = openStorage({
    STORAGE_PROVIDER: "s3",
    STORAGE_S3_ENDPOINT: "https://s3.ir-thr-at1.arvanstorage.ir",
    STORAGE_S3_BUCKET: "shahoo-bucket",
    STORAGE_S3_REGION: "default",
    STORAGE_S3_ACCESS_KEY_ID: "key_id",
    STORAGE_S3_SECRET_ACCESS_KEY: "secret_val",
  });
  assert.ok(modern);
  assert.equal(modern.storageKey("item.webp"), "s3:item.webp");

  const legacy = openStorage({
    STORAGE_PROVIDER: "s3",
    S3_ENDPOINT: "https://s3.ir-thr-at1.arvanstorage.ir",
    S3_BUCKET: "shahoo-bucket",
    S3_REGION: "default",
    S3_ACCESS_KEY: "key_id",
    S3_SECRET_KEY: "secret_val",
  });
  assert.ok(legacy);
  assert.equal(legacy.storageKey("item.webp"), "s3:item.webp");
});

test("Remediation Suite 2: Carrier Tracking Safe Mapping & No False Post Links", () => {
  const iranPost = resolveCarrierTracking("پست پیشتاز", "248911111111111111111111");
  assert.equal(iranPost.carrierLabel, "پست پیشتاز");
  assert.equal(iranPost.url, "https://tracking.post.ir/");
  assert.ok(iranPost.buttonLabel.includes("پست"));

  const tipax = resolveCarrierTracking("تیپاکس اکسپرس", "TPX-998877");
  assert.equal(tipax.carrierLabel, "تیپاکس");
  assert.equal(tipax.url, "https://tipaxco.com/tracking");
  assert.ok(tipax.buttonLabel.includes("تیپاکس"));

  const chapar = resolveCarrierTracking("شرکت حمل‌ونقل چاپار", "CHP-554433");
  assert.equal(chapar.carrierLabel, "کالارسان چاپار");
  assert.equal(chapar.url, "https://www.chaparnet.com/track");
  assert.ok(chapar.buttonLabel.includes("چاپار"));

  // Critical requirement: Non-standard carriers do NOT lead to broken Iran Post links
  const courier = resolveCarrierTracking("پیک درون‌شهری شاهو", "RUNNER-12");
  assert.equal(courier.url, null);
  assert.equal(courier.buttonLabel, "");
  assert.equal(courier.carrierLabel, "پیک درون‌شهری شاهو");
});

test("Remediation Suite 3: CMS FAQ and Trust Marks Defaults & Structure", () => {
  // FAQs
  assert.equal(DEFAULT_PRODUCT_FAQS.length, 5);
  for (const item of DEFAULT_PRODUCT_FAQS) {
    assert.ok(item.id.startsWith("faq-"));
    assert.ok(item.q.length > 0);
    assert.ok(item.a.length > 0);
    assert.equal(item.isActive, true);
  }

  // Trust marks
  assert.equal(DEFAULT_TRUST_MARKS.length, 2);
  const enamad = DEFAULT_TRUST_MARKS.find((m) => m.provider === "enamad");
  const samandehi = DEFAULT_TRUST_MARKS.find((m) => m.provider === "samandehi");
  assert.equal(enamad?.status, "pending");
  assert.equal(samandehi?.status, "pending");
  assert.equal(enamad?.verifyUrl, undefined);
  assert.equal(samandehi?.verifyUrl, undefined);
});

test("Remediation Suite 4: Formula Injection Sanitization in Excel/XLSX Export", () => {
  assert.equal(sanitizeSpreadsheetText("معمولی"), "معمولی");
  // Formulas starting with =, +, -, @ must be prefixed with apostrophe ' (escaped to &apos; in XML)
  assert.equal(sanitizeSpreadsheetText("=1+1"), "&apos;=1+1");
  assert.equal(sanitizeSpreadsheetText("+989123456789"), "&apos;+989123456789");
  assert.equal(sanitizeSpreadsheetText("-50000"), "&apos;-50000");
  assert.equal(sanitizeSpreadsheetText("@admin"), "&apos;@admin");

  // In XML output
  const mockOrder = {
    publicCode: "SH-FORMULA",
    createdAtLabel: "۱۴۰۳/۰۹/۰۳",
    fullName: "=DDE('cmd';'/C calc';'A0')",
    mobile: "+989120000000",
    province: "کردستان",
    city: "سنندج",
    addressLine: "@DangerousAddress",
    postalCode: "-6613500000",
    carrier: "پست",
    statusLabel: "تکمیل",
    paymentStatusLabel: "پرداخت شده",
    totalIrr: 1000000,
    subtotalIrr: 1000000,
    shippingIrr: 0,
    discountIrr: 0,
    customerNote: "@DangerousFormulaNote",
    lines: [
      {
        id: "l1",
        name: "=SUM(A1:A10)",
        label: "+500ml",
        sku: "-SKU-001",
        quantity: 1,
        unitPriceIrr: 1000000,
        lineTotalIrr: 1000000,
      },
    ],
  };

  const sheetXml = buildInvoiceSheetXml(mockOrder);
  // Ensure formula payloads are quoted
  assert.ok(sheetXml.includes("&apos;=DDE"));
  assert.ok(sheetXml.includes("&apos;+989120000000"));
  assert.ok(sheetXml.includes("&apos;@DangerousFormulaNote"));
  assert.ok(sheetXml.includes("&apos;-6613500000"));
  assert.ok(sheetXml.includes("&apos;=SUM(A1:A10)"));
});

test("Remediation Suite 5: Currency Conversion & Exact Integer Arithmetic", () => {
  // Test boundary values with truncation
  assert.equal(irrToToman(0), 0);
  assert.equal(irrToToman(9), 0);
  assert.equal(irrToToman(10), 1);
  assert.equal(irrToToman(19), 1);
  assert.equal(irrToToman(20), 2);
  assert.equal(irrToToman(150_000_000), 15_000_000);

  // Formatting strings
  assert.equal(formatTomanFromIrr(150_000_000), "۱۵,۰۰۰,۰۰۰ تومان");
  assert.equal(formatTomanFromIrr(2_500_000), "۲۵۰,۰۰۰ تومان");
});

test("Remediation Suite 6: Iranian Geography Data Completeness", () => {
  assert.equal(IRAN_PROVINCES.length, 31);
  for (const prov of IRAN_PROVINCES) {
    const cities = getCitiesForProvince(prov);
    assert.ok(cities.length > 0, `Province ${prov} must have at least one city mapped`);
    assert.ok(isValidCityForProvince(prov, cities[0]));
  }
});

test("Remediation Suite 7: Commerce Inventory Hold and Line Sellability State Matrix", () => {
  // Valid active line
  assert.equal(
    isLineSellable({
      productStatus: "published",
      variantStatus: "active",
      productDeletedAt: null,
      categoryActive: true,
      categoryDeletedAt: null,
    }),
    true,
  );

  // Inactive variant disables line
  assert.equal(
    isLineSellable({
      productStatus: "published",
      variantStatus: "draft",
      productDeletedAt: null,
      categoryActive: true,
      categoryDeletedAt: null,
    }),
    false,
  );

  // Deleted category disables line
  assert.equal(
    isLineSellable({
      productStatus: "published",
      variantStatus: "active",
      productDeletedAt: null,
      categoryActive: true,
      categoryDeletedAt: new Date(),
    }),
    false,
  );
});
