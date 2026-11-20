import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { demoSeedAllowed } from "../env/runtime.ts";
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
  "0011_batch_05_customer_account.sql",
  "0012_batch_07_inventory_audit.sql",
];

async function open() {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of migrations) await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  return { pg, db: drizzle(pg, { schema }) };
}

async function counts(pg: PGlite) {
  const rows = await pg.query<{ products: number; coupons: number; shipping: number; perms: number }>(`
    select
      (select count(*) from products)::int as products,
      (select count(*) from coupons)::int as coupons,
      (select count(*) from shipping_methods)::int as shipping,
      (select count(*) from admin_permissions)::int as perms
  `);
  return rows.rows[0];
}

test("production initialization stores no demo products or coupons", async () => {
  const { pg, db } = await open();
  const env = { NODE_ENV: "production", SEED_DEMO: "1" } as NodeJS.ProcessEnv;
  assert.equal(demoSeedAllowed(env), false);
  await seedFoundation(db, { demo: demoSeedAllowed(env) });
  const first = await counts(pg);
  assert.equal(Number(first?.products), 0);
  assert.equal(Number(first?.coupons), 0);
  assert.equal(Number(first?.shipping), 0);
  assert.equal(Number(first?.perms) > 0, true);
  const codes = await pg.query<{ code: string }>("select code from coupons");
  assert.equal(codes.rows.some((row) => row.code === "SHAHOO10" || row.code === "ORGANIC20"), false);
  await seedFoundation(db, { demo: false });
  const second = await counts(pg);
  assert.equal(Number(second?.products), 0);
  assert.equal(Number(second?.shipping), Number(first?.shipping));
  await seedFoundation(db, { demo: true });
  const demo = await counts(pg);
  assert.equal(Number(demo?.products) > 0, true);
  assert.equal(Number(demo?.coupons), 2);
  await seedFoundation(db, { demo: true });
  const again = await counts(pg);
  assert.equal(Number(again?.products), Number(demo?.products));
  assert.equal(Number(again?.coupons), 2);
});

test("fresh production initialization provisions the three CMS sections without demo records", async () => {
  const { pg, db } = await open();
  await pg.exec(readFileSync(join(root, "migrations", "0009_batch_04_home_copy.sql"), "utf8"));
  const provision = readFileSync(join(root, "migrations", "0010_batch_04_home_sections.sql"), "utf8");
  await pg.exec(provision);
  await seedFoundation(db, { demo: false });

  const rows = await pg.query<{
    id: string;
    section_type: string;
    title: string;
    subtitle: string;
    config: { limit?: number; flags?: string[] };
    sort_order: number;
    is_active: boolean;
  }>("select id, section_type, title, subtitle, config, sort_order, is_active from homepage_sections order by sort_order");
  assert.deepEqual(rows.rows, [
    {
      id: "sec-best",
      section_type: "best_sellers",
      title: "پرفروش‌های شاهو",
      subtitle: "انتخاب‌هایی که مشتریان شاهو بیشتر سراغشان می‌روند.",
      config: { limit: 4, flags: ["best"] },
      sort_order: 1,
      is_active: true,
    },
    {
      id: "sec-new",
      section_type: "new_arrivals",
      title: "تازه‌های ماه",
      subtitle: "تازه به شاهو رسیده‌اند؛ نگاهی به انتخاب‌های جدید بیندازید.",
      config: { limit: 4, flags: ["newest"] },
      sort_order: 2,
      is_active: true,
    },
    {
      id: "sec-offers",
      section_type: "special_offers",
      title: "پیشنهادهای ویژه",
      subtitle: "انتخاب‌های ویژه‌ای که شاید همان چیزی باشند که دنبالش هستید.",
      config: { limit: 4, flags: ["offer"] },
      sort_order: 3,
      is_active: true,
    },
  ]);

  await pg.exec(provision);
  await seedFoundation(db, { demo: false });
  const counts = await pg.query<{ products: number; customers: number; orders: number; coupons: number; banners: number; sections: number }>(`
    select
      (select count(*) from products)::int as products,
      (select count(*) from customers)::int as customers,
      (select count(*) from orders)::int as orders,
      (select count(*) from coupons)::int as coupons,
      (select count(*) from banners)::int as banners,
      (select count(*) from homepage_sections where section_type in ('best_sellers', 'new_arrivals', 'special_offers'))::int as sections
  `);
  assert.deepEqual(counts.rows[0], { products: 0, customers: 0, orders: 0, coupons: 0, banners: 0, sections: 3 });
  assert.equal((await pg.query("select id from homepage_sections where section_type = 'featured_products'")).rows.length, 0);
  assert.equal((await pg.query("select key from settings where key = 'foundation.seed'")).rows.length, 0);
});

test("demo seeding preserves migration-provisioned homepage section types", async () => {
  const { pg, db } = await open();
  await pg.exec(readFileSync(join(root, "migrations", "0009_batch_04_home_copy.sql"), "utf8"));
  await pg.exec(readFileSync(join(root, "migrations", "0010_batch_04_home_sections.sql"), "utf8"));

  await seedFoundation(db, { demo: true });
  const sections = await pg.query<{ section_type: string; count: number }>(`
    select section_type, count(*)::int as count
    from homepage_sections
    group by section_type
    order by section_type
  `);
  assert.deepEqual(sections.rows, [
    { section_type: "best_sellers", count: 1 },
    { section_type: "brand_benefits", count: 1 },
    { section_type: "brand_introduction", count: 1 },
    { section_type: "featured_categories", count: 1 },
    { section_type: "hero", count: 1 },
    { section_type: "magazine_articles", count: 1 },
    { section_type: "new_arrivals", count: 1 },
    { section_type: "newsletter", count: 1 },
    { section_type: "special_offers", count: 1 },
  ]);
});

test("homepage section provisioning creates only missing types and preserves CMS edits on rerun", async () => {
  const { pg } = await open();
  await pg.exec(readFileSync(join(root, "migrations", "0009_batch_04_home_copy.sql"), "utf8"));
  await pg.exec(`
    insert into homepage_sections (id, section_type, title, subtitle, body, config, sort_order, is_active) values
      ('admin-best', 'best_sellers', 'عنوان مدیر', 'توضیح مدیر', 'متن مدیر', '{"limit":7,"flags":["best"]}', 12, false),
      ('sec-offers', 'custom_section', 'بخش موجود', 'متن موجود', '', '{}', 70, true),
      ('old-featured', 'featured_products', 'برگزیده‌ها', 'متن قدیمی', '', '{}', 90, true),
      ('admin-newsletter', 'newsletter', 'خبر مدیر', 'متن حفظ‌شده', '', '{}', 23, true)
  `);
  const existingBefore = (await pg.query(
    "select id, section_type, title, subtitle, body, config, sort_order, is_active from homepage_sections order by id",
  )).rows;
  const provision = readFileSync(join(root, "migrations", "0010_batch_04_home_sections.sql"), "utf8");
  await pg.exec(provision);

  const existingAfter = (await pg.query(
    "select id, section_type, title, subtitle, body, config, sort_order, is_active from homepage_sections where id in ('admin-best', 'sec-offers', 'old-featured', 'admin-newsletter') order by id",
  )).rows;
  assert.deepEqual(existingAfter, existingBefore);
  const added = await pg.query<{ id: string; section_type: string; sort_order: number }>(
    "select id, section_type, sort_order from homepage_sections where section_type in ('best_sellers', 'new_arrivals', 'special_offers') order by sort_order",
  );
  assert.deepEqual(added.rows, [
    { id: "admin-best", section_type: "best_sellers", sort_order: 12 },
    { id: "sec-new", section_type: "new_arrivals", sort_order: 91 },
    { id: "shahoo-home-special_offers-1", section_type: "special_offers", sort_order: 92 },
  ]);

  await pg.exec(`
    update homepage_sections
    set title = 'تازه‌های منتخب مدیر', subtitle = 'توضیح ثبت‌شده در CMS', is_active = false,
        sort_order = 4, config = '{"limit":2,"flags":["newest"]}'
    where id = 'sec-new'
  `);
  const customized = (await pg.query(
    "select id, section_type, title, subtitle, config, sort_order, is_active from homepage_sections where id = 'sec-new'",
  )).rows;
  await pg.exec(provision);
  await pg.exec(provision);
  assert.deepEqual(
    (await pg.query("select id, section_type, title, subtitle, config, sort_order, is_active from homepage_sections where id = 'sec-new'")).rows,
    customized,
  );
  const finalCounts = await pg.query<{ section_type: string; count: number }>(`
    select section_type, count(*)::int as count
    from homepage_sections
    where section_type in ('best_sellers', 'new_arrivals', 'special_offers', 'featured_products', 'newsletter', 'custom_section')
    group by section_type
    order by section_type
  `);
  assert.deepEqual(finalCounts.rows, [
    { section_type: "best_sellers", count: 1 },
    { section_type: "custom_section", count: 1 },
    { section_type: "featured_products", count: 1 },
    { section_type: "new_arrivals", count: 1 },
    { section_type: "newsletter", count: 1 },
    { section_type: "special_offers", count: 1 },
  ]);
});

// An imported/partially provisioned database can have customized defaults without the marker.
test("baseline seed preserves existing settings when the baseline marker is missing", async () => {
  const { pg, db } = await open();
  try {
    await pg.exec(`
      insert into settings (key, value, updated_at) values
        ('store.profile', '{"brandName":"مدیر","tagline":"محصولات","phone":"02188776655","whatsapp":"","email":"","address":"","instagram":"","telegram":"","copyright":"مدیر"}', '2020-01-01T00:00:00Z'),
        ('header.promo', '{"text":"پیام مدیر"}', '2020-01-02T00:00:00Z')
    `);
    const before = (await pg.query("select * from settings order by key")).rows;
    await seedFoundation(db, { demo: false });
    const preserved = (await pg.query("select * from settings where key in ('store.profile', 'header.promo') order by key")).rows;
    assert.deepEqual(preserved, before);
    const seeded = (await pg.query<{ key: string }>("select key from settings order by key")).rows.map(({ key }) => key);
    assert.deepEqual(seeded, ["brand.logos", "foundation.baseline", "header.promo", "store.profile", "store.story"]);
    assert.equal((await pg.query("select * from sms_templates")).rows.length, 5);
    assert.equal((await pg.query("select * from products")).rows.length, 0);
    const allSettings = (await pg.query("select * from settings order by key")).rows;
    await seedFoundation(db, { demo: false });
    assert.deepEqual((await pg.query("select * from settings order by key")).rows, allSettings);
  } finally {
    await pg.close();
  }
});

test("baseline seed preserves existing SMS templates by key without a marker", async () => {
  const { pg, db } = await open();
  try {
    await pg.exec(`
      insert into sms_templates (id, key, body, is_active, updated_at) values
        ('custom-otp', 'otp', 'custom OTP {code}', false, '2020-01-01T00:00:00Z'),
        ('sms-order', 'order_confirmed', 'custom order {order}', false, '2020-01-02T00:00:00Z')
    `);
    const before = (await pg.query("select * from sms_templates order by key")).rows;
    await seedFoundation(db, { demo: false });
    assert.deepEqual(
      (await pg.query("select * from sms_templates where key in ('otp', 'order_confirmed') order by key")).rows,
      before,
    );
    assert.equal((await pg.query("select * from sms_templates")).rows.length, 5);
    assert.equal((await pg.query("select * from settings where key = 'foundation.baseline'")).rows.length, 1);
    const templates = (await pg.query("select * from sms_templates order by key")).rows;
    await seedFoundation(db, { demo: false });
    assert.deepEqual((await pg.query("select * from sms_templates order by key")).rows, templates);
  } finally {
    await pg.close();
  }
});

test("demo seed preserves custom sections that occupy canonical and fallback IDs", async () => {
  const { pg, db } = await open();
  try {
    await pg.exec(readFileSync(join(root, "migrations", "0009_batch_04_home_copy.sql"), "utf8"));
    await pg.exec(`
      insert into homepage_sections (id, section_type, title, subtitle, body, background, template_key, config, sort_order, is_active, created_at, updated_at) values
        ('sec-best', 'featured_products', 'مدیر ۱', 'زیرنویس ۱', 'متن ۱', 'gold', 'custom', '{"limit":7}', 11, false, '2020-01-01Z', '2020-01-02Z'),
        ('sec-hero', 'newsletter', 'مدیر ۲', 'زیرنویس ۲', 'متن ۲', 'white', 'custom', '{}', 12, false, '2020-01-01Z', '2020-01-02Z'),
        ('sec-hero-1', 'brand_introduction', 'مدیر ۳', '', '', '', 'custom', '{}', 13, true, '2020-01-01Z', '2020-01-02Z'),
        ('admin-benefits', 'brand_benefits', 'تعهد مدیر', '', '', '', 'custom', '{"items":[{"title":"تعهد","text":"متن سفارشی"}]}', 14, false, '2020-01-01Z', '2020-01-02Z')
    `);
    await pg.exec(readFileSync(join(root, "migrations", "0010_batch_04_home_sections.sql"), "utf8"));
    const before = (await pg.query("select * from homepage_sections order by id")).rows;
    await seedFoundation(db, { demo: true });
    assert.deepEqual(
      (await pg.query("select * from homepage_sections where id in ('sec-best', 'sec-hero', 'sec-hero-1', 'admin-benefits', 'shahoo-home-best_sellers-1', 'sec-new', 'sec-offers') order by id")).rows,
      before,
    );
    const structural = (await pg.query<{ id: string; section_type: string }>(
      "select id, section_type from homepage_sections where section_type in ('best_sellers', 'new_arrivals', 'special_offers', 'hero', 'newsletter') order by section_type",
    )).rows;
    assert.deepEqual(structural, [
      { id: "shahoo-home-best_sellers-1", section_type: "best_sellers" },
      { id: "sec-hero-2", section_type: "hero" },
      { id: "sec-new", section_type: "new_arrivals" },
      { id: "sec-hero", section_type: "newsletter" },
      { id: "sec-offers", section_type: "special_offers" },
    ]);
    assert.equal((await pg.query("select * from products")).rows.length > 0, true);
    assert.equal((await pg.query("select * from settings where key in ('foundation.baseline', 'foundation.seed')")).rows.length, 2);
    const allSections = (await pg.query("select * from homepage_sections order by id")).rows;
    await seedFoundation(db, { demo: true });
    await seedFoundation(db, { demo: false });
    assert.deepEqual((await pg.query("select * from homepage_sections order by id")).rows, allSections);
  } finally {
    await pg.close();
  }
});

function assertDatabaseConstraint(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: { code?: string; constraint?: string } }).cause;
  assert.equal(cause?.code, "23505");
  assert.equal(cause?.constraint, constraint);
  return true;
}

test("baseline seed propagates an unrelated SMS primary-key conflict and rolls back", async () => {
  const { pg, db } = await open();
  try {
    await pg.exec("insert into sms_templates (id, key, body) values ('sms-otp', 'custom_key', 'preserve')");
    const before = (await pg.query("select * from sms_templates")).rows;
    const permissionsBefore = (await pg.query("select * from admin_permissions order by id")).rows;
    await assert.rejects(seedFoundation(db, { demo: false }), (error) => assertDatabaseConstraint(error, "sms_templates_pkey"));
    assert.deepEqual((await pg.query("select * from sms_templates")).rows, before);
    assert.equal((await pg.query("select * from settings")).rows.length, 0);
    assert.deepEqual((await pg.query("select * from admin_permissions order by id")).rows, permissionsBefore);
  } finally {
    await pg.close();
  }
});

test("demo seed propagates an unrelated category primary-key conflict and rolls back", async () => {
  const { pg, db } = await open();
  try {
    await pg.exec("insert into product_categories (id, slug, name, short_name) values ('oils', 'custom-oils', 'custom', 'custom')");
    const before = (await pg.query("select * from product_categories")).rows;
    await assert.rejects(seedFoundation(db, { demo: true }), (error) => assertDatabaseConstraint(error, "product_categories_pkey"));
    assert.deepEqual((await pg.query("select * from product_categories")).rows, before);
    assert.equal((await pg.query("select * from settings")).rows.length, 0);
    assert.equal((await pg.query("select * from sms_templates")).rows.length, 0);
    assert.equal((await pg.query("select * from media_assets")).rows.length, 0);
    assert.equal((await pg.query("select * from products")).rows.length, 0);
  } finally {
    await pg.close();
  }
});
