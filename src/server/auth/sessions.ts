import { and, eq, isNull } from "drizzle-orm";
import type { AppDatabase } from "../db/client";
import {
  adminPermissions,
  adminRolePermissions,
  adminRoles,
  adminSessions,
  adminUserRoles,
  adminUsers,
  customerSessions,
  customers,
} from "../db/schema";
import { asTime } from "./db";
import { hashSessionToken } from "./crypto";
import { ADMIN_COOKIE, CUSTOMER_COOKIE, readSessionCookie } from "./cookies";

export type CustomerPrincipal = {
  id: string;
  mobile: string;
  fullName: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  ageGroup: string | null;
  sessionId: string;
};

export type AdminPrincipal = {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  sessionId: string;
  roles: Array<{ key: string; name: string }>;
  permissions: string[];
};

export async function readCustomer(db: AppDatabase): Promise<CustomerPrincipal | null> {
  const token = readSessionCookie(CUSTOMER_COOKIE);
  if (!token) return null;
  const [session] = await db
    .select()
    .from(customerSessions)
    .where(eq(customerSessions.tokenHash, hashSessionToken(token)))
    .limit(1);
  if (!session || session.revokedAt || asTime(session.expiresAt) <= Date.now()) return null;
  const [customer] = await db.select().from(customers).where(eq(customers.id, session.customerId)).limit(1);
  if (!customer || customer.deletedAt || customer.status !== "active" || !customer.mobile) return null;
  return {
    id: customer.id,
    mobile: customer.mobile,
    fullName: customer.fullName,
    firstName: customer.firstName,
    lastName: customer.lastName,
    gender: customer.gender,
    ageGroup: customer.ageGroup,
    sessionId: session.id,
  };
}

export async function readAdmin(db: AppDatabase): Promise<AdminPrincipal | null> {
  const token = readSessionCookie(ADMIN_COOKIE);
  if (!token) return null;
  const [session] = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.tokenHash, hashSessionToken(token)))
    .limit(1);
  if (!session || session.revokedAt || asTime(session.expiresAt) <= Date.now()) return null;
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(and(eq(adminUsers.id, session.adminUserId), isNull(adminUsers.deletedAt)))
    .limit(1);
  if (!user || user.status !== "active") return null;

  const roles = await db
    .select({ key: adminRoles.key, name: adminRoles.name })
    .from(adminUserRoles)
    .innerJoin(adminRoles, eq(adminUserRoles.roleId, adminRoles.id))
    .where(eq(adminUserRoles.adminUserId, user.id));
  const permissionRows = await db
    .select({ key: adminPermissions.key })
    .from(adminUserRoles)
    .innerJoin(adminRolePermissions, eq(adminUserRoles.roleId, adminRolePermissions.roleId))
    .innerJoin(adminPermissions, eq(adminRolePermissions.permissionId, adminPermissions.id))
    .where(eq(adminUserRoles.adminUserId, user.id));

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    sessionId: session.id,
    roles,
    permissions: [...new Set(permissionRows.map((row) => row.key))],
  };
}
