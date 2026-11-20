import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, it } from "node:test";
import * as schema from "../db/schema.ts";
import { customerAddresses, customers } from "../db/schema.ts";
import { removeAddress, saveAddress, setDefaultAddress } from "./addresses.ts";

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

async function open() {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of migrations) await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  const db = drizzle(pg, { schema });
  await db.insert(customers).values([
    { id: "cust-a", mobile: "09120000001", fullName: "آزاده رضایی", status: "active" },
    { id: "cust-b", mobile: "09120000002", fullName: "مشتری دوم", status: "active" },
  ]);
  return { pg, db };
}

const address = {
  label: "خانه",
  recipientName: "آزاده رضایی",
  recipientMobile: "۰۹۱۲۰۰۰۰۰۰۱",
  province: "تهران",
  city: "تهران",
  addressLine: "خیابان نمونه، کوچه گل، ساختمان یک",
  postalCode: "۱۲۳۴۵۶۷۸۹۰",
  plaque: "۱۲",
  unit: "۳",
};

describe("customer address book", () => {
  it("stores normalized recipient data and maintains one default when removing it", async () => {
    const { db } = await open();
    const first = await saveAddress(db, "cust-a", address);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.addresses.length, 1);
    assert.equal(first.addresses[0]?.recipientMobile, "09120000001");
    assert.equal(first.addresses[0]?.postalCode, "1234567890");
    assert.equal(first.addresses[0]?.isDefault, true);

    const edited = await saveAddress(db, "cust-a", { ...address, id: first.addresses[0]!.id, recipientName: "آزاده کریمی" });
    assert.equal(edited.ok, true);
    if (!edited.ok) return;
    assert.equal(edited.addresses[0]?.recipientName, "آزاده کریمی");

    const second = await saveAddress(db, "cust-a", { ...address, label: "کار", city: "کرج" });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.addresses.filter((item) => item.isDefault).length, 1);
    assert.equal(second.addresses.length, 2);
    const secondId = second.addresses.find((item) => item.label === "کار")!.id;

    const switched = await setDefaultAddress(db, "cust-a", secondId);
    assert.equal(switched.ok, true);
    if (!switched.ok) return;
    assert.equal(switched.addresses.filter((item) => item.isDefault).length, 1);
    const selected = switched.addresses.find((item) => item.isDefault);
    assert.equal(selected?.id, secondId);

    const removed = await removeAddress(db, "cust-a", secondId);
    assert.equal(removed.ok, true);
    if (!removed.ok) return;
    assert.equal(removed.addresses.length, 1);
    assert.equal(removed.addresses[0]?.isDefault, true);
    assert.equal(removed.addresses[0]?.id, first.addresses[0]?.id);
  });

  it("rejects cross-customer updates/deletes and only changes defaults for owned live addresses", async () => {
    const { db } = await open();
    const created = await saveAddress(db, "cust-a", address);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const id = created.addresses[0]!.id;
    const attack = await saveAddress(db, "cust-b", { ...address, id, recipientName: "نفوذ" });
    assert.equal(attack.ok, false);
    const deletion = await removeAddress(db, "cust-b", id);
    assert.equal(deletion.ok, false);
    const defaultAttempt = await setDefaultAddress(db, "cust-b", id);
    assert.equal(defaultAttempt.ok, false);
    const [unchanged] = await db.select().from(customerAddresses);
    assert.equal(unchanged?.recipientName, "آزاده رضایی");
    assert.equal(unchanged?.customerId, "cust-a");
  });

  it("lets the database enforce at most one non-deleted default per customer", async () => {
    const { db } = await open();
    const created = await saveAddress(db, "cust-a", address);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await assert.rejects(() => db.insert(customerAddresses).values({
      ...created.addresses[0]!,
      id: "second-default",
      customerId: "cust-a",
      isDefault: true,
    }));
  });
});
