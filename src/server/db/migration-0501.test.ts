import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../../migrations/0004_batch_0501.sql", import.meta.url), "utf8");

test("batch 05.01 migration adds throttle, coupon identity, and read permissions", () => {
  assert.match(sql, /create table if not exists auth_throttle/i);
  assert.match(sql, /subject_hash/);
  assert.match(sql, /coupon_id/);
  assert.match(sql, /inventory\.read/);
  assert.match(sql, /customers\.write/);
  assert.match(sql, /settings\.read/);
  assert.match(sql, /admins\.read/);
  assert.match(sql, /product_manager/);
  assert.match(sql, /order_manager/);
  assert.doesNotMatch(sql, /greatest\s*\(\s*0\s*,\s*reserved/i);
});
