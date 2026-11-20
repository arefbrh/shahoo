import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { ACCESS_PERMISSIONS, ACCESS_ROLES } from "./access-seed.ts";
import * as schema from "./schema.ts";
import { seedFoundation } from "./seed.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const V050_PERMISSIONS = [
  ["catalog.read", "مشاهده کاتالوگ"],
  ["catalog.write", "ویرایش محصولات و دسته‌ها"],
  ["inventory.write", "اصلاح موجودی"],
  ["orders.read", "مشاهده سفارش‌ها"],
  ["orders.write", "تغییر وضعیت سفارش"],
  ["customers.read", "مشاهده مشتریان"],
  ["content.write", "ویرایش محتوای سایت"],
  ["settings.write", "تنظیمات فروشگاه"],
  ["admins.write", "مدیریت مدیران"],
  ["reports.read", "گزارش فروش"],
] as const;

const V050_ROLES = [
  ["super_admin", V050_PERMISSIONS.map(([key]) => key)],
  ["product_manager", ["catalog.read", "catalog.write", "inventory.write"]],
  ["order_manager", ["orders.read", "orders.write", "customers.read"]],
  ["content_manager", ["content.write", "catalog.read"]],
  ["customer_support", ["orders.read", "customers.read", "catalog.read"]],
] as const;

async function apply(pg: PGlite, names: string[]) {
  for (const name of names) await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
}

async function open(names: string[]) {
  const pg = new PGlite();
  await pg.waitReady;
  await apply(pg, names);
  return { pg, db: drizzle(pg, { schema }) };
}

async function grants(pg: PGlite) {
  const rows = await pg.query<{ role: string; permission: string }>(`
    select r.key as role, p.key as permission
    from admin_role_permissions rp
    join admin_roles r on r.id = rp.role_id
    join admin_permissions p on p.id = rp.permission_id
    order by r.key, p.key
  `);
  return rows.rows;
}

function expectGrants(rows: Array<{ role: string; permission: string }>, role: string, permissions: readonly string[]) {
  const actual = rows.filter((row) => row.role === role).map((row) => row.permission).sort();
  assert.deepEqual(actual, [...permissions].sort(), role);
}

test("fresh database migrations and seed create the 05.02 access model once", async () => {
  const { pg, db } = await open([
    "0002_shahoo_foundation.sql",
    "0003_commerce_cart.sql",
    "0004_batch_0501.sql",
    "0005_batch_0502.sql",
  ]);
  const tables = await pg.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  const names = new Set(tables.rows.map((row) => row.table_name));
  for (const name of ["orders", "coupons", "inventory", "auth_throttle", "ops_diagnostics", "admin_roles", "admin_users"]) {
    assert.equal(names.has(name), true, name);
  }
  const fk = await pg.query<{ def: string }>(
    "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'orders_coupon_id_fkey'",
  );
  assert.match(fk.rows[0]?.def ?? "", /FOREIGN KEY \(coupon_id\) REFERENCES coupons\(id\) ON DELETE SET NULL/i);

  await seedFoundation(db);
  const once = await grants(pg);
  assert.equal(once.length > 0, true);
  for (const [role, , , permissions] of ACCESS_ROLES) expectGrants(once, role, permissions);
  assert.equal(ACCESS_PERMISSIONS.length, 15);
  assert.equal(ACCESS_PERMISSIONS.some(([key]) => key === "support.write"), true);

  const before = await pg.query<{ products: number; perms: number; admins: number }>(`
    select
      (select count(*) from products) as products,
      (select count(*) from admin_permissions) as perms,
      (select count(*) from admin_users) as admins
  `);
  await seedFoundation(db);
  const after = await pg.query<{ products: number; perms: number; admins: number }>(`
    select
      (select count(*) from products) as products,
      (select count(*) from admin_permissions) as perms,
      (select count(*) from admin_users) as admins
  `);
  assert.equal(Number(after.rows[0]?.products), Number(before.rows[0]?.products));
  assert.equal(Number(after.rows[0]?.perms), Number(before.rows[0]?.perms));
  assert.equal(Number(after.rows[0]?.admins), 0);
  const seedSource = readFileSync(join(root, "src/server/db/seed.ts"), "utf8");
  const accessSource = readFileSync(join(root, "src/server/db/access-seed.ts"), "utf8");
  assert.equal(seedSource.includes("passwordHash"), false);
  assert.equal(accessSource.includes("passwordHash"), false);
  assert.equal(seedSource.includes("adminUsers"), false);
});

test("0004 and 0005 upgrade a v0.5.0 database without guessing a coupon", async () => {
  const { pg, db } = await open(["0002_shahoo_foundation.sql", "0003_commerce_cart.sql"]);
  for (const [key, description] of V050_PERMISSIONS) {
    await pg.query("insert into admin_permissions (id, key, description) values ($1, $2, $3)", [`perm-${key}`, key, description]);
  }
  for (const [key, permissions] of V050_ROLES) {
    const name = key;
    await pg.query("insert into admin_roles (id, key, name) values ($1, $2, $3)", [`role-${key}`, key, name]);
    for (const permission of permissions) {
      await pg.query("insert into admin_role_permissions (role_id, permission_id) values ($1, $2)", [
        `role-${key}`,
        `perm-${permission}`,
      ]);
    }
  }
  await pg.exec(`
    insert into product_categories (id, slug, name, short_name) values ('cat-fix', 'cat-fix', 'دسته', 'د');
    insert into products (id, category_id, slug, sku, name) values ('prod-fix', 'cat-fix', 'prod-fix', 'SKU-FIX', 'محصول');
    insert into product_variants (id, product_id, sku, label, price_irr) values ('var-fix', 'prod-fix', 'SKU-FIX-1', 'بسته', 1000);
    insert into inventory (variant_id, on_hand, reserved, low_stock_threshold) values ('var-fix', 12, 3, 5);
    insert into coupons (id, code) values ('coupon-shahoo10', 'SHAHOO10'), ('coupon-lower', 'sale'), ('coupon-upper', 'SALE');
    insert into orders (id, public_code, full_name, mobile, province, city, address_line, subtotal_irr, total_irr, coupon_code, status)
      values
        ('ord-unique', 'SH-20260101-UNIQ', 'آزاده', '09120000000', 'تهران', 'تهران', 'خیابان', 100000, 90000, 'shahoo10', 'awaiting_payment'),
        ('ord-ambiguous', 'SH-20260101-AMB', 'آزاده', '09120000000', 'تهران', 'تهران', 'خیابان', 100000, 90000, 'Sale', 'awaiting_payment');
    insert into settings (key, value) values ('foundation.seed', '{"version":1}'::jsonb);
  `);

  await apply(pg, ["0004_batch_0501.sql", "0005_batch_0502.sql"]);
  const orders = await pg.query<{ id: string; coupon_code: string; coupon_id: string | null; total_irr: string }>(
    "select id, coupon_code, coupon_id, total_irr::text from orders order by id",
  );
  const unique = orders.rows.find((row) => row.id === "ord-unique");
  const ambiguous = orders.rows.find((row) => row.id === "ord-ambiguous");
  assert.equal(unique?.coupon_code, "shahoo10");
  assert.equal(unique?.coupon_id, "coupon-shahoo10");
  assert.equal(unique?.total_irr, "90000");
  assert.equal(ambiguous?.coupon_code, "Sale");
  assert.equal(ambiguous?.coupon_id, null);
  const stock = await pg.query<{ on_hand: number; reserved: number }>("select on_hand, reserved from inventory where variant_id = 'var-fix'");
  assert.equal(stock.rows[0]?.on_hand, 12);
  assert.equal(stock.rows[0]?.reserved, 3);

  const rows = await grants(pg);
  expectGrants(rows, "product_manager", ["catalog.read", "catalog.write", "inventory.write", "inventory.read"]);
  expectGrants(rows, "order_manager", ["orders.read", "orders.write", "customers.read", "settings.read"]);
  expectGrants(rows, "content_manager", ["content.write", "catalog.read"]);
  expectGrants(rows, "customer_support", ["orders.read", "customers.read", "catalog.read"]);
  for (const key of ["inventory.read", "customers.write", "settings.read", "admins.read"]) {
    assert.equal(rows.some((row) => row.role === "super_admin" && row.permission === key), true, key);
    assert.equal(rows.filter((row) => row.permission === key).length >= 1, true);
  }
  const permCount = await pg.query<{ n: number }>("select count(*)::int as n from admin_permissions where key = 'inventory.read'");
  assert.equal(permCount.rows[0]?.n, 1);

  const productsBefore = await pg.query<{ n: number }>("select count(*)::int as n from products");
  await seedFoundation(db);
  const productsAfter = await pg.query<{ n: number }>("select count(*)::int as n from products");
  const admins = await pg.query<{ n: number }>("select count(*)::int as n from admin_users");
  assert.equal(productsAfter.rows[0]?.n, productsBefore.rows[0]?.n);
  assert.equal(admins.rows[0]?.n, 0);
});
