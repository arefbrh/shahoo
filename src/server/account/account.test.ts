import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, it } from "node:test";
import * as schema from "../db/schema.ts";
import { customers } from "../db/schema.ts";
import { customerOrderSummaries } from "../commerce/orders.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const migrations = [
  "0002_shahoo_foundation.sql", "0003_commerce_cart.sql", "0004_batch_0501.sql", "0005_batch_0502.sql",
  "0006_completion.sql", "0007_media_primary.sql", "0008_batch_02.sql", "0009_batch_04_home_copy.sql",
  "0010_batch_04_home_sections.sql", "0011_batch_05_customer_account.sql",
  "0012_batch_07_inventory_audit.sql",
];

async function open() {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of migrations) await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  const db = drizzle(pg, { schema });
  await db.insert(customers).values([
    { id: "cust-a", mobile: "09120000001", fullName: "آزاده رضایی", status: "active" },
    { id: "cust-b", mobile: "09120000002", fullName: "مشتری دوم", status: "active" },
    { id: "cust-empty", mobile: "09120000003", fullName: "بدون سفارش", status: "active" },
  ]);
  return { pg, db };
}

describe("customer order history projection", () => {
  it("returns only the customer's bounded order projection with Persian labels and no delivery mobile/raw states", async () => {
    const { pg, db } = await open();
    await pg.exec(`
      INSERT INTO orders (id, public_code, customer_id, status, payment_status, stock_state, full_name, mobile, province, city, address_line, subtotal_irr, total_irr)
      VALUES
        ('order-a', 'SH-20261119-AAAA', 'cust-a', 'awaiting_payment', 'unpaid', 'held', 'گیرنده', '09129999999', 'تهران', 'تهران', 'نشانی آزمایشی معتبر', 120000, 120000),
        ('order-b', 'SH-20261119-BBBB', 'cust-b', 'delivered', 'verified', 'captured', 'گیرنده دوم', '09128888888', 'تهران', 'تهران', 'نشانی دیگر معتبر', 340000, 340000)
    `);
    const own = await customerOrderSummaries(db, "cust-a");
    assert.equal(own.length, 1);
    assert.equal(own[0]?.publicCode, "SH-20261119-AAAA");
    assert.equal(own[0]?.statusLabel, "در انتظار پرداخت");
    assert.equal(own[0]?.paymentStatusLabel, "پرداخت نشده");
    assert.equal("status" in own[0]!, false);
    assert.equal("paymentStatus" in own[0]!, false);
    assert.equal("mobileMasked" in own[0]!, false);
    assert.deepEqual(await customerOrderSummaries(db, "cust-empty"), []);
  });
});
