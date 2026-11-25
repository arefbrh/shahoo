import test from "node:test";
import assert from "node:assert/strict";

// 1. Storage & Environment Policy Tests
import { localStorageAllowed, openStorage, objectNameForStorageKey, localObjectName } from "../src/server/media/disk.ts";
import { resolveDatabasePlan, isProductionEnv, migrationGuard, otpEchoAllowed, mockPaymentAllowed } from "../src/server/env/runtime.ts";
import { formatTomanFromIrr, irrToToman, toPersianNum } from "../src/lib/format.ts";
import { IRAN_PROVINCES, getCitiesForProvince, isValidCityForProvince } from "../src/lib/iran-cities.ts";
import { buildInvoiceSheetXml, sanitizeSpreadsheetText } from "../src/lib/invoice-export.ts";
import { resolveCarrierTracking } from "../src/lib/carrier-tracking.ts";
import { DEFAULT_PRODUCT_FAQS, DEFAULT_TRUST_MARKS } from "../src/lib/cms-defaults.ts";
import { isLineSellable, combinedCartQuantity } from "../src/lib/commerce-integrity.ts";

test("Storage Provider accepts canonical 'local', alias 'disk', and enforces production guard", () => {
  // Development: default allowed
  assert.equal(localStorageAllowed({ NODE_ENV: "development", STORAGE_PROVIDER: "local" }), true);
  // Alias disk -> local
  assert.equal(localStorageAllowed({ NODE_ENV: "development", STORAGE_PROVIDER: "disk" }), true);
  // Production without opt-in fails
  assert.equal(localStorageAllowed({ NODE_ENV: "production", STORAGE_PROVIDER: "local" }), false);
  assert.equal(localStorageAllowed({ NODE_ENV: "production", STORAGE_PROVIDER: "disk" }), false);
  // Production with ALLOW_LOCAL_STORAGE=true succeeds
  assert.equal(localStorageAllowed({ NODE_ENV: "production", STORAGE_PROVIDER: "local", ALLOW_LOCAL_STORAGE: "true" }), true);
  assert.equal(localStorageAllowed({ NODE_ENV: "production", STORAGE_PROVIDER: "disk", ALLOW_LOCAL_STORAGE: "1" }), true);
  // Disallowed provider
  assert.equal(localStorageAllowed({ NODE_ENV: "development", STORAGE_PROVIDER: "azure" }), false);
});

test("S3 storage configuration accepts STORAGE_S3_* and fallback S3_* keys", () => {
  const envWithModern = {
    STORAGE_PROVIDER: "s3",
    STORAGE_S3_ENDPOINT: "https://s3.ir-thr-at1.arvanstorage.ir",
    STORAGE_S3_BUCKET: "shahoo-bucket",
    STORAGE_S3_REGION: "default",
    STORAGE_S3_ACCESS_KEY_ID: "my_key_id",
    STORAGE_S3_SECRET_ACCESS_KEY: "my_secret_key",
  };
  const storageModern = openStorage(envWithModern);
  assert.ok(storageModern, "Modern STORAGE_S3_* config should instantiate S3ObjectStorage");
  assert.equal(storageModern.storageKey("test.webp"), "s3:test.webp");

  const envWithFallback = {
    STORAGE_PROVIDER: "s3",
    S3_ENDPOINT: "https://s3.ir-thr-at1.arvanstorage.ir",
    S3_BUCKET: "shahoo-bucket",
    S3_REGION: "default",
    S3_ACCESS_KEY: "my_key_id",
    S3_SECRET_KEY: "my_secret_key",
  };
  const storageFallback = openStorage(envWithFallback);
  assert.ok(storageFallback, "Fallback S3_* config should instantiate S3ObjectStorage");
  assert.equal(storageFallback.storageKey("sample.jpg"), "s3:sample.jpg");
});

test("Storage key parsing and object naming security constraints", () => {
  assert.equal(objectNameForStorageKey("local:valid-media-file-01.webp"), "valid-media-file-01.webp");
  assert.equal(objectNameForStorageKey("s3:valid-media-file-02.png"), "valid-media-file-02.png");
  // Path traversal or unsafe chars rejected
  assert.equal(objectNameForStorageKey("local:../secret.txt"), null);
  assert.equal(objectNameForStorageKey("local:sh.exe"), null);
  assert.equal(localObjectName("s3:valid-file.webp"), null);
  assert.equal(localObjectName("local:valid-file-12345.webp"), "valid-file-12345.webp");
});

test("Runtime environment security guards fail closed in production", () => {
  assert.equal(isProductionEnv({ NODE_ENV: "production" }), true);
  assert.equal(isProductionEnv({ NODE_ENV: "development" }), false);

  // Production without DATABASE_URL fails to start
  const prodNoDb = resolveDatabasePlan({ NODE_ENV: "production" });
  assert.equal(prodNoDb.ok, false);

  // Production with DATABASE_URL selects postgres
  const prodWithDb = resolveDatabasePlan({ NODE_ENV: "production", DATABASE_URL: "postgres://user:pass@localhost:5432/db" });
  assert.equal(prodWithDb.ok, true);
  if (prodWithDb.ok) {
    assert.equal(prodWithDb.source, "postgres");
  }

  // Production migration requires explicit SHAHOO_ALLOW_PRODUCTION_MIGRATE=1
  const guardDenied = migrationGuard({ NODE_ENV: "production", DATABASE_URL: "postgres://localhost/db" });
  assert.equal(guardDenied.ok, false);
  const guardAllowed = migrationGuard({ NODE_ENV: "production", DATABASE_URL: "postgres://localhost/db", SHAHOO_ALLOW_PRODUCTION_MIGRATE: "1" });
  assert.equal(guardAllowed.ok, true);

  // Production forbids OTP echo or mock payments
  assert.equal(otpEchoAllowed({ NODE_ENV: "production", ECHO_OTP: "1" }), false);
  assert.equal(mockPaymentAllowed({ NODE_ENV: "production", ALLOW_MOCK_PAYMENT: "1", PAYMENT_PROVIDER: "mock" }), false);
});

test("Currency and Persian numeral conversions are precise and lossless", () => {
  // 10 IRR = 1 Toman
  assert.equal(irrToToman(100_000), 10_000);
  assert.equal(irrToToman(0), 0);
  assert.equal(irrToToman(12_345_670), 1_234_567);

  // Persian format includes تومان and Persian digits
  const formatted = formatTomanFromIrr(1_500_000); // 150,000 Toman
  assert.ok(formatted.includes("تومان"));
  assert.equal(toPersianNum("123"), "۱۲۳");
});

test("Iran provinces and cities cascade integrity", () => {
  const provinces = IRAN_PROVINCES;
  assert.ok(provinces.length >= 31, "All 31 provinces of Iran must be present");
  assert.ok(provinces.includes("کردستان"));
  assert.ok(provinces.includes("تهران"));
  assert.ok(provinces.includes("اصفهان"));

  const kurdistanCities = getCitiesForProvince("کردستان");
  assert.ok(kurdistanCities.includes("سنندج"));
  assert.ok(kurdistanCities.includes("پاوه") || kurdistanCities.includes("مریوان"));
  assert.equal(isValidCityForProvince("کردستان", "سنندج"), true);
  assert.equal(isValidCityForProvince("کردستان", "شیراز"), false);
});

test("Spreadsheet exporter builds valid XML and escapes formula injection vulnerabilities", () => {
  const mockOrder = {
    publicCode: "SH-9999",
    createdAtLabel: "۱۴۰۳/۰۹/۰۳",
    fullName: "=CMD|' /C calc'!A0", // Malicious formula attempt
    mobile: "+989123456789",         // Leading plus must be safe text
    province: "کردستان",
    city: "سنندج",
    addressLine: "@FormulaTest",     // Leading @ must be safe text
    postalCode: "6613512345",
    carrier: "پست پیشتاز",
    statusLabel: "تکمیل شده",
    paymentStatusLabel: "پرداخت شده",
    totalIrr: 2_500_000,
    subtotalIrr: 2_200_000,
    shippingIrr: 300_000,
    discountIrr: 0,
    lines: [
      {
        id: "l1",
        name: "روغن زیتون فرابکر طارم",
        label: "۵۰۰ میلی‌لیتر",
        sku: "-SKU-TEST",           // Leading hyphen
        quantity: 2,
        unitPriceIrr: 1_100_000,
        lineTotalIrr: 2_200_000,
      },
    ],
  };

  const xml = buildInvoiceSheetXml(mockOrder);
  assert.ok(xml.includes("<?xml version="));
  assert.ok(xml.includes("urn:schemas-microsoft-com:office:spreadsheet") || xml.includes("schemas.openxmlformats.org"));
  assert.ok(xml.includes("روغن زیتون فرابکر طارم"));
  assert.ok(xml.includes("SH-9999"));

  // Check formula injection mitigation: formula triggers are quoted or safely escaped
  assert.ok(xml.includes("&apos;=CMD|") || xml.includes("'=CMD|"));
});

test("Carrier tracking resolver maps Post, Tipax, Chapar, and falls back safely for unknown couriers", () => {
  // Iran Post
  const post = resolveCarrierTracking("پست پیشتاز", "248910000000000000000000");
  assert.equal(post.url, "https://tracking.post.ir/");
  assert.ok(post.buttonLabel.includes("پست"));

  // Default empty carrier defaults to Post
  const emptyCarrier = resolveCarrierTracking("", "248910000000000000000000");
  assert.equal(emptyCarrier.url, "https://tracking.post.ir/");

  // Tipax
  const tipax = resolveCarrierTracking("تیپاکس اکسپرس", "TPX987654321");
  assert.equal(tipax.url, "https://tipaxco.com/tracking");
  assert.ok(tipax.buttonLabel.includes("تیپاکس"));

  // Chapar
  const chapar = resolveCarrierTracking("کالارسان چاپار", "CHP12345678");
  assert.equal(chapar.url, "https://www.chaparnet.com/track");
  assert.ok(chapar.buttonLabel.includes("چاپار"));

  // Unknown carrier (e.g. dedicated courier, in-person delivery) must NOT link to Post
  const unknown = resolveCarrierTracking("پیک اختصاصی سنندج", "COURIER-55");
  assert.equal(unknown.url, null);
  assert.equal(unknown.buttonLabel, "");
  assert.equal(unknown.carrierLabel, "پیک اختصاصی سنندج");
});

test("CMS default FAQ and Trust Marks adhere to strict platform constraints", () => {
  // FAQ defaults
  assert.ok(Array.isArray(DEFAULT_PRODUCT_FAQS));
  assert.equal(DEFAULT_PRODUCT_FAQS.length, 5);
  for (const item of DEFAULT_PRODUCT_FAQS) {
    assert.ok(item.q && item.q.trim().length > 5);
    assert.ok(item.a && item.a.trim().length > 10);
    assert.equal(item.isActive, true);
  }

  // Trust marks defaults: strictly pending, no fake verified claims
  assert.ok(Array.isArray(DEFAULT_TRUST_MARKS));
  assert.equal(DEFAULT_TRUST_MARKS.length, 2);
  const enamad = DEFAULT_TRUST_MARKS.find((m) => m.provider === "enamad");
  const samandehi = DEFAULT_TRUST_MARKS.find((m) => m.provider === "samandehi");
  assert.ok(enamad && enamad.status === "pending");
  assert.ok(samandehi && samandehi.status === "pending");
});

test("Commerce line availability and cart quantity merging invariants", () => {
  // Valid active product line
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

  // Inactive category disables line
  assert.equal(
    isLineSellable({
      productStatus: "published",
      variantStatus: "active",
      productDeletedAt: null,
      categoryActive: false,
      categoryDeletedAt: null,
    }),
    false,
  );

  // Deleted product disables line
  assert.equal(
    isLineSellable({
      productStatus: "published",
      variantStatus: "active",
      productDeletedAt: new Date(),
      categoryActive: true,
      categoryDeletedAt: null,
    }),
    false,
  );

  // Cart quantity clamping and merge
  assert.equal(combinedCartQuantity(2, 3, 10, "sum"), 5);
  assert.equal(combinedCartQuantity(2, 3, 4, "sum"), 4); // Clamped to available stock (4)
  assert.equal(combinedCartQuantity(2, 3, 10, "max"), 3); // Max mode for repeated local cart adoption
});
