import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

async function db() {
  const pg = new PGlite();
  await pg.exec(`
    create table coupons (id text primary key, code text unique, used_count integer not null default 0, usage_limit integer);
    create table orders (
      id text primary key,
      public_code text not null,
      status text not null,
      coupon_id text references coupons (id),
      coupon_code text
    );
    create table inventory (variant_id text primary key, reserved integer not null, on_hand integer not null);
    create table order_items (id text primary key, order_id text not null, variant_id text, quantity integer not null);
    create table audit_logs (id text primary key, action text not null);
  `);
  return pg;
}

test("renaming or reusing a coupon code does not restore the wrong counter", async () => {
  const pg = await db();
  await pg.exec(`
    insert into coupons (id, code, used_count, usage_limit) values ('coupon-a', 'OLD', 1, 5), ('coupon-b', 'OTHER', 0, 5);
    insert into orders (id, public_code, status, coupon_id, coupon_code) values ('ord-1', 'SH-20260321-AAAA', 'awaiting_payment', 'coupon-a', 'OLD');
    update coupons set code = 'RENAMED' where id = 'coupon-a';
    update coupons set code = 'OLD' where id = 'coupon-b';
  `);
  await pg.query(`update coupons set used_count = used_count - 1 where id = (select coupon_id from orders where id = 'ord-1') and used_count > 0`);
  const rows = await pg.query<{ id: string; used_count: number }>(`select id, used_count from coupons order by id`);
  assert.equal(rows.rows.find((row) => row.id === "coupon-a")?.used_count, 0);
  assert.equal(rows.rows.find((row) => row.id === "coupon-b")?.used_count, 0);
});

test("coupon usage limit stays atomic when two checkouts race the last slot", async () => {
  const pg = await db();
  await pg.exec(`insert into coupons (id, code, used_count, usage_limit) values ('coupon-a', 'ONCE', 0, 1)`);
  const first = await pg.query(`update coupons set used_count = used_count + 1 where id = 'coupon-a' and (usage_limit is null or used_count < usage_limit) returning id`);
  const second = await pg.query(`update coupons set used_count = used_count + 1 where id = 'coupon-a' and (usage_limit is null or used_count < usage_limit) returning id`);
  assert.equal(first.rows.length, 1);
  assert.equal(second.rows.length, 0);
  const left = await pg.query<{ used_count: number }>(`select used_count from coupons where id = 'coupon-a'`);
  assert.equal(left.rows[0]?.used_count, 1);
});

test("a failed stock release rolls back the order status and the success audit", async () => {
  const pg = await db();
  await pg.exec(`
    insert into inventory (variant_id, reserved, on_hand) values ('var-1', 0, 5);
    insert into orders (id, public_code, status) values ('ord-1', 'SH-20260321-BBBB', 'awaiting_payment');
    insert into order_items (id, order_id, variant_id, quantity) values ('oi-1', 'ord-1', 'var-1', 2);
  `);
  await assert.rejects(async () => {
    await pg.transaction(async (tx) => {
      await tx.query(`update orders set status = 'cancelled' where id = 'ord-1'`);
      const stock = await tx.query<{ reserved: number }>(`select reserved from inventory where variant_id = 'var-1'`);
      if ((stock.rows[0]?.reserved ?? 0) < 2) throw new Error("shortfall");
      await tx.query(`insert into audit_logs (id, action) values ('aud-1', 'order.cancelled')`);
    });
  });
  const order = await pg.query<{ status: string }>(`select status from orders where id = 'ord-1'`);
  const audits = await pg.query(`select id from audit_logs`);
  assert.equal(order.rows[0]?.status, "awaiting_payment");
  assert.equal(audits.rows.length, 0);
});
