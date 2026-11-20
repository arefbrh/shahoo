import { and, eq, isNull } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { writeAudit } from "../auth/audit.ts";
import * as schema from "../db/schema.ts";
import { adminRoles, adminUserRoles, adminUsers } from "../db/schema.ts";

const LAST_SUPER = "آخرین مدیر ارشد فعال را نمی‌توان برداشت.";

type Database = PgliteDatabase<typeof schema>;

export async function applyStaffChange(
  db: Database,
  input: { actorId: string; userId: string; status: string; roleKeys: string[] },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.status !== "active" && input.status !== "disabled") return { ok: false, message: "وضعیت مدیر معتبر نیست." };
  const roles = [...new Set(input.roleKeys.map((role) => role.trim()).filter(Boolean))];
  if (roles.length === 0) return { ok: false, message: "حداقل یک نقش لازم است." };
  if (input.userId === input.actorId && input.status !== "active") return { ok: false, message: "نمی‌توانید حساب خود را ببندید." };
  let blocked = "";
  try {
    await db.transaction(async (tx) => {
      const lockedRole = await tx.select({ id: adminRoles.id }).from(adminRoles).where(eq(adminRoles.key, "super_admin")).for("update");
      if (lockedRole.length === 0) {
        blocked = "نقش مدیر ارشد در پایگاه داده پیدا نشد.";
        throw new Error(blocked);
      }
      const [user] = await tx
        .select()
        .from(adminUsers)
        .where(and(eq(adminUsers.id, input.userId), isNull(adminUsers.deletedAt)))
        .for("update");
      if (!user) {
        blocked = "مدیر پیدا نشد.";
        throw new Error(blocked);
      }
      if (input.status === "active" && !user.passwordHash) {
        blocked = "این مدیر هنوز از بیرون برنامه فعال نشده است.";
        throw new Error(blocked);
      }
      const known = await tx.select({ id: adminRoles.id, key: adminRoles.key }).from(adminRoles);
      const wanted = known.filter((role) => roles.includes(role.key));
      if (wanted.length !== roles.length) {
        blocked = "یکی از نقش‌ها شناخته نشد.";
        throw new Error(blocked);
      }
      const current = await tx
        .select({ key: adminRoles.key })
        .from(adminUserRoles)
        .innerJoin(adminRoles, eq(adminRoles.id, adminUserRoles.roleId))
        .where(eq(adminUserRoles.adminUserId, user.id));
      const wasSuper = user.status === "active" && current.some((role) => role.key === "super_admin");
      const willSuper = input.status === "active" && wanted.some((role) => role.key === "super_admin");
      if (wasSuper && !willSuper) {
        const supers = await tx
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .innerJoin(adminUserRoles, eq(adminUserRoles.adminUserId, adminUsers.id))
          .innerJoin(adminRoles, eq(adminRoles.id, adminUserRoles.roleId))
          .where(and(eq(adminRoles.key, "super_admin"), eq(adminUsers.status, "active"), isNull(adminUsers.deletedAt)));
        if (supers.length <= 1) {
          blocked = LAST_SUPER;
          throw new Error(blocked);
        }
      }
      await tx.update(adminUsers).set({ status: input.status, updatedAt: new Date() }).where(eq(adminUsers.id, user.id));
      await tx.delete(adminUserRoles).where(eq(adminUserRoles.adminUserId, user.id));
      await tx.insert(adminUserRoles).values(wanted.map((role) => ({ adminUserId: user.id, roleId: role.id })));
      await writeAudit(tx, {
        actorType: "admin",
        actorId: input.actorId,
        action: "admin.roles_updated",
        entityType: "admin_user",
        entityId: user.id,
        metadata: { status: input.status, roles: roles.join(",") },
      });
    });
  } catch (error) {
    if (blocked) return { ok: false, message: blocked };
    throw error;
  }
  return { ok: true };
}
