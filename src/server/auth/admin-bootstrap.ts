import { and, eq } from "drizzle-orm";
import { adminUserRoles, adminUsers } from "../db/schema";
import type { AppDatabase } from "../db/client";
import { writeAudit } from "./audit";
import { isSecretHash } from "./crypto";
import { maskIdentifier, normalizeIranMobile } from "./mobile";

/**
 * First-time bootstrap creates the env admin only when that email does not exist.
 * Later calls do nothing unless an explicit flag is set:
 * - SHAHOO_ADMIN_ROTATE=1 updates the password of an active, non-deleted admin.
 * - SHAHOO_ADMIN_RECOVER=1 reactivates a suspended/deleted admin and ensures super_admin.
 * Neither flag runs implicitly. A suspended admin is never restored just because
 * the process restarted.
 */
export async function ensureAdminFromEnv(db: AppDatabase): Promise<void> {
  const email = process.env.SHAHOO_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const passwordHash = process.env.SHAHOO_ADMIN_PASSWORD_HASH?.trim() ?? "";
  if (!email.includes("@") || email.length > 120 || !isSecretHash(passwordHash)) return;

  const fullName = (process.env.SHAHOO_ADMIN_NAME?.trim() || "مدیر شاهو").slice(0, 80);
  const mobile = process.env.SHAHOO_ADMIN_MOBILE ? normalizeIranMobile(process.env.SHAHOO_ADMIN_MOBILE) : null;
  const rotate = process.env.SHAHOO_ADMIN_ROTATE === "1";
  const recover = process.env.SHAHOO_ADMIN_RECOVER === "1";
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);

  if (!existing) {
    const id = `adm-${crypto.randomUUID()}`;
    await db.insert(adminUsers).values({
      id,
      email,
      fullName,
      mobile,
      passwordHash,
      status: "active",
    });
    await db.insert(adminUserRoles).values({ adminUserId: id, roleId: "role-super_admin" });
    await writeAudit(db, {
      actorType: "system",
      actorId: id,
      action: "admin.bootstrapped",
      entityType: "admin_user",
      entityId: id,
      metadata: { identifier: maskIdentifier(email) },
    });
    return;
  }

  const suspended = existing.status !== "active" || existing.deletedAt !== null;
  if (suspended) {
    if (!recover) return;
    await db
      .update(adminUsers)
      .set({
        passwordHash,
        status: "active",
        deletedAt: null,
        fullName: existing.fullName || fullName,
        mobile: existing.mobile ?? mobile,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, existing.id));
    await ensureSuperAdminRole(db, existing.id);
    await writeAudit(db, {
      actorType: "system",
      actorId: existing.id,
      action: "admin.recovered",
      entityType: "admin_user",
      entityId: existing.id,
      metadata: { identifier: maskIdentifier(email) },
    });
    return;
  }

  if (rotate && existing.passwordHash !== passwordHash) {
    await db
      .update(adminUsers)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(adminUsers.id, existing.id));
    await writeAudit(db, {
      actorType: "system",
      actorId: existing.id,
      action: "admin.password_rotated",
      entityType: "admin_user",
      entityId: existing.id,
      metadata: { identifier: maskIdentifier(email) },
    });
  }
}

async function ensureSuperAdminRole(db: AppDatabase, adminUserId: string): Promise<void> {
  const [role] = await db
    .select()
    .from(adminUserRoles)
    .where(and(eq(adminUserRoles.adminUserId, adminUserId), eq(adminUserRoles.roleId, "role-super_admin")))
    .limit(1);
  if (!role) await db.insert(adminUserRoles).values({ adminUserId, roleId: "role-super_admin" });
}
