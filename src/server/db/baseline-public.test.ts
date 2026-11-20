import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { contactRows, publicPromo, storyIsConfigured } from "../../lib/public-profile.ts";
import { isUnapprovedSeedShipping } from "../../lib/public-shipping.ts";
import { applyStoreProfile } from "../cms/content.ts";
import { applyShippingDraft } from "../offers/admin.ts";
import * as schema from "./schema.ts";
import { seedFoundation } from "./seed.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const migrations = [
  "0002_shahoo_foundation.sql",
  "0003_commerce_cart.sql",
  "0004_batch_0501.sql",
  "0005_batch_0502.sql",
  "0006_completion.sql",
  "0007_media_primary.sql",
  "0008_batch_02.sql",
  "0009_batch_04_home_copy.sql",
  "0010_batch_04_home_sections.sql",
  "0011_batch_05_customer_account.sql",
  "0012_batch_07_inventory_audit.sql",
];

function asContact(value: Record<string, unknown> | undefined) {
  return {
    phone: typeof value?.phone === "string" ? value.phone : "",
    whatsapp: typeof value?.whatsapp === "string" ? value.whatsapp : "",
    email: typeof value?.email === "string" ? value.email : "",
    address: typeof value?.address === "string" ? value.address : "",
    instagram: typeof value?.instagram === "string" ? value.instagram : "",
    telegram: typeof value?.telegram === "string" ? value.telegram : "",
  };
}

async function open(includeHomepageMigrations = true) {
  const pg = new PGlite();
  await pg.waitReady;
  const selected = includeHomepageMigrations ? migrations : migrations.slice(0, migrations.indexOf("0009_batch_04_home_copy.sql"));
  for (const name of selected) await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  return { pg, db: drizzle(pg, { schema }) };
}

test("fresh baseline publishes no sample contact, shipping price, or brand claim", async () => {
  const { pg, db } = await open();
  await seedFoundation(db, { demo: false });
  const settings = await pg.query<{ key: string; value: Record<string, unknown> }>("select key, value from settings");
  const map = new Map(settings.rows.map((row) => [row.key, row.value]));
  const profile = asContact(map.get("store.profile"));
  assert.deepEqual(contactRows(profile), []);
  assert.equal(profile.phone, "");
  assert.equal(profile.email, "");
  assert.equal(profile.address, "");
  const promo = map.get("header.promo");
  assert.equal(publicPromo(typeof promo?.text === "string" ? promo.text : ""), "");
  const story = map.get("store.story");
  assert.equal(
    storyIsConfigured({
      title: typeof story?.title === "string" ? story.title : "",
      about: typeof story?.about === "string" ? story.about : "",
      philosophy: typeof story?.philosophy === "string" ? story.philosophy : "",
    }),
    false,
  );
  const shipping = await pg.query<{ price_irr: number; free_over_irr: number | null }>("select price_irr, free_over_irr from shipping_methods");
  assert.equal(shipping.rows.length, 0);

  const saved = await applyStoreProfile(db, "admin-test", {
    phone: "02188776655",
    whatsapp: "09120001122",
    email: "hello@example.com",
    address: "تهران، خیابان ولیعصر، پلاک ۱۰",
    instagram: "shahoo.shop",
    telegram: "shahoo_shop",
  });
  assert.equal(saved.ok, true);
  const next = await pg.query<{ value: Record<string, unknown> }>("select value from settings where key = 'store.profile'");
  const rows = contactRows(asContact(next.rows[0]?.value));
  assert.equal(rows.find((row) => row.key === "phone")?.href, "tel:02188776655");
  assert.equal(rows.find((row) => row.key === "email")?.text, "hello@example.com");
  assert.equal(rows.find((row) => row.key === "address")?.text.includes("ولیعصر"), true);

  const shipped = await applyShippingDraft(db, "admin-test", {
    key: "city-post",
    title: "پست شهری",
    description: "مبلغی که مدیر فروشگاه وارد کرده است",
    priceToman: 90_000,
    freeOverToman: null,
    sortOrder: 1,
    isActive: true,
  });
  assert.equal(shipped.ok, true);
  const methods = await pg.query<{ id: string; key: string; price_irr: number | string; free_over_irr: number | null; is_active: boolean }>(
    "select id, key, price_irr, free_over_irr, is_active from shipping_methods",
  );
  assert.equal(methods.rows.length, 1);
  const method = methods.rows[0]!;
  assert.equal(method.is_active, true);
  assert.equal(
    isUnapprovedSeedShipping({
      id: method.id,
      key: method.key,
      priceIrr: Number(method.price_irr),
      freeOverIrr: method.free_over_irr === null ? null : Number(method.free_over_irr),
    }),
    false,
  );
});

test("Batch 04 copy migration changes only legacy seed text and is repeatable", async () => {
  const { pg } = await open(false);
  await pg.exec(`
    insert into homepage_sections (id, section_type, title, subtitle, body, config, sort_order, is_active) values
      ('sec-best', 'best_sellers', 'پرفروش‌های شاهو', 'آنچه بیشتر انتخاب شده است', 'متن مدیر', '{"limit":7,"flags":["featured"]}', 17, false),
      ('sec-new', 'new_arrivals', 'تازه‌های کاتالوگ', 'بسته‌بندی‌ها و ترکیب‌های تازه‌تر', '', '{"limit":3,"flags":["newest"]}', 8, true),
      ('sec-offers', 'special_offers', 'پیشنهادهای ویژه', 'فقط جایی که قیمت قبلی واقعی ثبت شده', '', '{"limit":2,"flags":["offer"]}', 6, true),
      ('sec-featured', 'featured_products', 'برگزیده‌ها', 'انتخاب ویترین', '', '{}', 4, true),
      ('unrelated', 'newsletter', 'خبر', 'متن مدیر', '', '{}', 20, true);
  `);
  const migration = readFileSync(join(root, "migrations/0009_batch_04_home_copy.sql"), "utf8");
  await pg.exec(migration);
  await pg.exec(migration);
  const rows = (await pg.query<{ id: string; title: string; subtitle: string; body: string; config: { limit?: number; flags?: string[] }; sort_order: number; is_active: boolean }>(
    "select id, title, subtitle, body, config, sort_order, is_active from homepage_sections order by id",
  )).rows;
  const best = rows.find((row) => row.id === "sec-best")!;
  assert.equal(best.subtitle, "انتخاب‌هایی که مشتریان شاهو بیشتر سراغشان می‌روند.");
  assert.equal(best.body, "متن مدیر");
  assert.deepEqual(best.config, { limit: 7, flags: ["featured"] });
  assert.equal(best.sort_order, 17);
  assert.equal(best.is_active, false);
  const fresh = rows.find((row) => row.id === "sec-new")!;
  assert.equal(fresh.title, "تازه‌های ماه");
  assert.equal(fresh.subtitle, "تازه به شاهو رسیده‌اند؛ نگاهی به انتخاب‌های جدید بیندازید.");
  assert.equal(rows.find((row) => row.id === "sec-offers")?.subtitle, "انتخاب‌های ویژه‌ای که شاید همان چیزی باشند که دنبالش هستید.");
  assert.equal(rows.find((row) => row.id === "sec-featured")?.title, "برگزیده‌ها");
  assert.equal(rows.find((row) => row.id === "unrelated")?.subtitle, "متن مدیر");
  assert.equal(rows.length, 5);
});

test("Batch 04 copy migration preserves custom or differently identified CMS values", async () => {
  const { pg } = await open(false);
  await pg.exec(`
    insert into homepage_sections (id, section_type, title, subtitle) values
      ('sec-best', 'best_sellers', 'پرفروش اختصاصی', 'آنچه بیشتر انتخاب شده است'),
      ('sec-new', 'new_arrivals', 'تازه‌های اختصاصی', 'متن اختصاصی'),
      ('sec-offers', 'newsletter', 'پیشنهادهای ویژه', 'فقط جایی که قیمت قبلی واقعی ثبت شده'),
      ('another-new', 'new_arrivals', 'تازه‌های کاتالوگ', 'بسته‌بندی‌ها و ترکیب‌های تازه‌تر');
    insert into audit_logs (id, actor_type, action, entity_type, entity_id)
      values ('section-edit', 'admin', 'content.section_updated', 'homepage_section', 'sec-best');
  `);
  const before = (await pg.query("select id, title, subtitle from homepage_sections order by id")).rows;
  await pg.exec(readFileSync(join(root, "migrations/0009_batch_04_home_copy.sql"), "utf8"));
  const after = (await pg.query("select id, title, subtitle from homepage_sections order by id")).rows;
  assert.deepEqual(after, before);
});
