import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { auditLogs } from "../db/schema.ts";
import * as schema from "../db/schema.ts";
import { adminRoles, adminUserRoles, adminUsers } from "../db/schema.ts";
import { applyStaffChange } from "./access-control.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function database() {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(readFileSync(join(root, "migrations/0002_shahoo_foundation.sql"), "utf8"));
  const db = drizzle(pg, { schema });
  await db.insert(adminRoles).values([
    { id: "role-super_admin", key: "super_admin", name: "مدیر ارشد", description: "" },
    { id: "role-product_manager", key: "product_manager", name: "مدیر محصول", description: "" },
  ]);
  await db.insert(adminUsers).values([
    { id: "admin-a", email: "a@shahoo.test", fullName: "آوا", passwordHash: "present", status: "active" },
    { id: "admin-b", email: "b@shahoo.test", fullName: "بهار", passwordHash: "present", status: "active" },
  ]);
  await db.insert(adminUserRoles).values([
    { adminUserId: "admin-a", roleId: "role-super_admin" },
    { adminUserId: "admin-b", roleId: "role-super_admin" },
  ]);
  return db;
}

async function activeSupers(db: Awaited<ReturnType<typeof database>>) {
  const rows = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .innerJoin(adminUserRoles, eq(adminUserRoles.adminUserId, adminUsers.id))
    .innerJoin(adminRoles, eq(adminRoles.id, adminUserRoles.roleId))
    .where(and(eq(adminRoles.key, "super_admin"), eq(adminUsers.status, "active")));
  return rows.map((row) => row.id).sort();
}

test("one active super admin cannot be demoted or disabled", async () => {
  const db = await database();
  await applyStaffChange(db, { actorId: "admin-a", userId: "admin-b", status: "disabled", roleKeys: ["super_admin"] });
  const demote = await applyStaffChange(db, { actorId: "admin-a", userId: "admin-a", status: "active", roleKeys: ["product_manager"] });
  const disable = await applyStaffChange(db, { actorId: "admin-b", userId: "admin-a", status: "disabled", roleKeys: ["super_admin"] });
  assert.equal(demote.ok, false);
  assert.equal(disable.ok, false);
  if (!demote.ok) assert.match(demote.message, /آخرین مدیر ارشد/);
  assert.deepEqual(await activeSupers(db), ["admin-a"]);
  const audits = await db.select().from(auditLogs);
  assert.equal(audits.length, 1);
});

test("sequential demotion leaves the other super admin", async () => {
  const db = await database();
  const first = await applyStaffChange(db, { actorId: "admin-a", userId: "admin-a", status: "active", roleKeys: ["product_manager"] });
  const second = await applyStaffChange(db, { actorId: "admin-b", userId: "admin-b", status: "active", roleKeys: ["product_manager"] });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.deepEqual(await activeSupers(db), ["admin-b"]);
});

test("concurrent demotion and disabling keep one active super admin", async () => {
  const db = await database();
  const demotions = await Promise.all([
    applyStaffChange(db, { actorId: "admin-a", userId: "admin-a", status: "active", roleKeys: ["product_manager"] }),
    applyStaffChange(db, { actorId: "admin-b", userId: "admin-b", status: "active", roleKeys: ["product_manager"] }),
  ]);
  assert.equal(demotions.filter((result) => result.ok).length, 1);
  assert.equal((await activeSupers(db)).length, 1);

  const again = await database();
  const disabling = await Promise.all([
    applyStaffChange(again, { actorId: "admin-a", userId: "admin-b", status: "disabled", roleKeys: ["super_admin"] }),
    applyStaffChange(again, { actorId: "admin-b", userId: "admin-a", status: "disabled", roleKeys: ["super_admin"] }),
  ]);
  assert.equal(disabling.filter((result) => result.ok).length, 1);
  assert.equal((await activeSupers(again)).length, 1);
});

test("self demotion is refused for the last super admin and allowed when another remains", async () => {
  const db = await database();
  const allowed = await applyStaffChange(db, { actorId: "admin-a", userId: "admin-a", status: "active", roleKeys: ["product_manager"] });
  const refused = await applyStaffChange(db, { actorId: "admin-b", userId: "admin-b", status: "active", roleKeys: ["product_manager"] });
  const selfClose = await applyStaffChange(db, { actorId: "admin-b", userId: "admin-b", status: "disabled", roleKeys: ["super_admin"] });
  assert.equal(allowed.ok, true);
  assert.equal(refused.ok, false);
  assert.equal(selfClose.ok, false);
  if (!selfClose.ok) assert.match(selfClose.message, /حساب خود را ببندید/);
  assert.deepEqual(await activeSupers(db), ["admin-b"]);
});

test("a valid role change keeps the super admin role", async () => {
  const db = await database();
  const saved = await applyStaffChange(db, {
    actorId: "admin-a",
    userId: "admin-a",
    status: "active",
    roleKeys: ["super_admin", "product_manager"],
  });
  assert.equal(saved.ok, true);
  assert.deepEqual(await activeSupers(db), ["admin-a", "admin-b"]);
  const audits = await db.select().from(auditLogs);
  assert.equal(audits.length, 1);
  assert.equal(JSON.stringify(audits[0]?.metadata).includes("present"), false);
});
