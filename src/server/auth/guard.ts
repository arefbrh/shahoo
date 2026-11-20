import { openDb } from "./db";
import { readAdmin, readCustomer, type AdminPrincipal, type CustomerPrincipal } from "./sessions";
import type { AppDatabase } from "../db/client";
import { ensureAdminFromEnv } from "./admin-bootstrap";

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

/** Every future customer mutation must start here, then call writeAudit. */
export async function requireCustomer(): Promise<{ db: AppDatabase; customer: CustomerPrincipal }> {
  const db = await openDb();
  const customer = await readCustomer(db);
  if (!customer) throw new SessionError("برای این کار باید وارد حساب شوید.");
  return { db, customer };
}

/** Every future admin mutation must start here, then call writeAudit. */
export async function requireAdmin(permission?: string): Promise<{ db: AppDatabase; admin: AdminPrincipal }> {
  const db = await openDb();
  await ensureAdminFromEnv(db);
  const admin = await readAdmin(db);
  if (!admin) throw new SessionError("ورود مدیر لازم است.");
  if (permission && !admin.permissions.includes(permission)) {
    throw new SessionError("این دسترسی برای نقش شما فعال نیست.");
  }
  return { db, admin };
}

export async function requireAdminAny(permissions: string[]): Promise<{ db: AppDatabase; admin: AdminPrincipal }> {
  const result = await requireAdmin();
  if (permissions.length > 0 && !permissions.some((key) => result.admin.permissions.includes(key))) {
    throw new SessionError("این دسترسی برای نقش شما فعال نیست.");
  }
  return result;
}
