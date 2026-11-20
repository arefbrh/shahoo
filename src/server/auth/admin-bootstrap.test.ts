import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { hashSecret } from "./crypto.ts";
import { ensureAdminFromEnv } from "./admin-bootstrap.ts";
import { seedAccessControl } from "../db/access-seed.ts";
import { adminUserRoles, adminUsers } from "../db/schema.ts";
import * as schema from "../db/schema.ts";

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

const email = "owner@shahoo.test";
const firstHash = hashSecret("first-password");
const nextHash = hashSecret("rotated-password");

async function open() {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of migrations) await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
  const db = drizzle(pg, { schema });
  await seedAccessControl(db);
  return db;
}

function useEnv(values: Record<string, string | undefined>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

async function roleCount(db: Awaited<ReturnType<typeof open>>, adminId: string) {
  const rows = await db.select().from(adminUserRoles).where(eq(adminUserRoles.adminUserId, adminId));
  return rows.filter((row) => row.roleId === "role-super_admin").length;
}

test("bootstrap creates once and does not revive a suspended admin", async () => {
  const db = await open();
  const restore = useEnv({
    SHAHOO_ADMIN_EMAIL: email,
    SHAHOO_ADMIN_PASSWORD_HASH: firstHash,
    SHAHOO_ADMIN_ROTATE: undefined,
    SHAHOO_ADMIN_RECOVER: undefined,
  });
  try {
    await ensureAdminFromEnv(db);
    const [created] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    assert.equal(created?.status, "active");
    assert.equal(await roleCount(db, created!.id), 1);
    await ensureAdminFromEnv(db);
    const all = await db.select().from(adminUsers);
    assert.equal(all.length, 1);

    await db.update(adminUsers).set({ status: "disabled" }).where(eq(adminUsers.id, created!.id));
    await db.delete(adminUserRoles).where(eq(adminUserRoles.adminUserId, created!.id));
    process.env.SHAHOO_ADMIN_PASSWORD_HASH = nextHash;
    await ensureAdminFromEnv(db);
    const [suspended] = await db.select().from(adminUsers).where(eq(adminUsers.id, created!.id));
    assert.equal(suspended?.status, "disabled");
    assert.equal(suspended?.passwordHash, firstHash);
    assert.equal(await roleCount(db, created!.id), 0);

    process.env.SHAHOO_ADMIN_ROTATE = "1";
    await ensureAdminFromEnv(db);
    const [rotatedWhileSuspended] = await db.select().from(adminUsers).where(eq(adminUsers.id, created!.id));
    assert.equal(rotatedWhileSuspended?.status, "disabled");
    assert.equal(rotatedWhileSuspended?.passwordHash, firstHash);

    await db.update(adminUsers).set({ status: "active", deletedAt: null }).where(eq(adminUsers.id, created!.id));
    await ensureAdminFromEnv(db);
    const [rotated] = await db.select().from(adminUsers).where(eq(adminUsers.id, created!.id));
    assert.equal(rotated?.status, "active");
    assert.equal(rotated?.passwordHash, nextHash);
    assert.equal(await roleCount(db, created!.id), 0);

    process.env.SHAHOO_ADMIN_RECOVER = "1";
    await db.update(adminUsers).set({ status: "disabled", deletedAt: new Date() }).where(eq(adminUsers.id, created!.id));
    await ensureAdminFromEnv(db);
    const [recovered] = await db.select().from(adminUsers).where(eq(adminUsers.id, created!.id));
    assert.equal(recovered?.status, "active");
    assert.equal(recovered?.deletedAt, null);
    assert.equal(await roleCount(db, created!.id), 1);
  } finally {
    restore();
  }
});
