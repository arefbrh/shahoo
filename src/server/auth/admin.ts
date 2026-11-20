import { eq, sql } from "drizzle-orm";
import { failureDelayMs, isLocked, loginFailureMessage, prepareThrottle } from "@/lib/login-throttle";
import type { ActionResult, AdminSession } from "@/lib/session-types";
import { adminSessions, adminUsers } from "../db/schema";
import { writeAudit } from "./audit";
import { ensureAdminFromEnv } from "./admin-bootstrap";
import { ADMIN_COOKIE, clearSessionCookie, writeSessionCookie } from "./cookies";
import { hashSecret, hashSessionToken, newSessionToken, verifySecret } from "./crypto";
import { openDb } from "./db";
import { requireAdmin, SessionError } from "./guard";
import { maskIdentifier, normalizeIranMobile } from "./mobile";
import { ADMIN_SESSION_MS } from "./policy";
import { readLoginIp } from "./request-ip";
import { readAdmin } from "./sessions";
import { accountKey, applySuccessThrottle, cleanupExpiredThrottle, readThrottle, recordLoginFailures, throttleSubject } from "./throttle";

let timingPad: string | null = null;

function padHash(): string {
  timingPad ??= hashSecret("shahoo-admin-timing-pad");
  return timingPad;
}

function pause(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadAdminSession(): Promise<AdminSession> {
  const db = await openDb();
  await ensureAdminFromEnv(db);
  const admin = await readAdmin(db);
  if (!admin) return { authenticated: false };
  return {
    authenticated: true,
    fullName: admin.fullName,
    email: admin.email,
    mobile: admin.mobile,
    roles: admin.roles,
    permissions: admin.permissions,
  };
}

export async function loginAdmin(identifier: string, password: string): Promise<ActionResult> {
  const db = await openDb();
  await ensureAdminFromEnv(db);
  const mobile = normalizeIranMobile(identifier);
  const now = Date.now();
  const accountHash = throttleSubject("admin_login_account", accountKey(identifier, mobile));
  const ip = readLoginIp();
  const ipHash = ip ? throttleSubject("admin_login_ip", ip) : null;
  await cleanupExpiredThrottle(db, now);
  const accountState = prepareThrottle(await readThrottle(db, "admin_login_account", accountHash), now, "account");
  const ipState = ipHash ? prepareThrottle(await readThrottle(db, "admin_login_ip", ipHash), now, "ip") : null;
  if (isLocked(accountState, now) || (ipState !== null && isLocked(ipState, now))) {
    return { ok: false, message: loginFailureMessage(true) };
  }

  const email = identifier.trim().toLowerCase();
  const [user] = mobile
    ? await db.select().from(adminUsers).where(eq(adminUsers.mobile, mobile)).limit(1)
    : await db
        .select()
        .from(adminUsers)
        .where(sql`lower(${adminUsers.email}) = ${email}`)
        .limit(1);

  const usable = Boolean(user && !user.deletedAt && user.status === "active" && user.passwordHash);
  const matches = verifySecret(password, usable && user?.passwordHash ? user.passwordHash : padHash());
  if (!usable || !matches || !user) {
    const recorded = await recordLoginFailures(db, { accountHash, ipHash, now }, async (tx, result) => {
      const accountAudit = result.account.audit;
      const ipAudit = result.ip?.audit ?? "none";
      const kind = accountAudit === "lock" || ipAudit === "lock" ? "lock" : accountAudit === "failure" || ipAudit === "failure" ? "failure" : "none";
      if (kind === "none") return;
      await writeAudit(tx, {
        actorType: "anonymous",
        action: kind === "lock" ? "admin.login_locked" : "admin.login_failed",
        entityType: "admin_user",
        entityId: user?.id ?? null,
        metadata: { identifier: maskIdentifier(identifier) },
      });
    });
    const lockedNow = isLocked(recorded.account.state, now) || (recorded.ip !== null && isLocked(recorded.ip.state, now));
    await pause(failureDelayMs(recorded.account.state.failures));
    return { ok: false, message: loginFailureMessage(lockedNow) };
  }

  const token = newSessionToken();
  const sessionId = `asess-${crypto.randomUUID()}`;
  await db.transaction(async (tx) => {
    await applySuccessThrottle(tx, { accountHash, ipHash, now });
    await tx.insert(adminSessions).values({
      id: sessionId,
      adminUserId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + ADMIN_SESSION_MS),
    });
    await writeAudit(tx, {
      actorType: "admin",
      actorId: user.id,
      action: "admin.login",
      entityType: "admin_session",
      entityId: sessionId,
      metadata: { identifier: maskIdentifier(identifier) },
    });
  });
  writeSessionCookie(ADMIN_COOKIE, token, ADMIN_SESSION_MS / 1000);
  return { ok: true };
}

export async function logoutAdmin(): Promise<ActionResult> {
  try {
    const { db, admin } = await requireAdmin();
    await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.id, admin.sessionId));
    await writeAudit(db, {
      actorType: "admin",
      actorId: admin.id,
      action: "admin.logout",
      entityType: "admin_session",
      entityId: admin.sessionId,
    });
  } catch (error) {
    if (!(error instanceof SessionError)) throw error;
  }
  clearSessionCookie(ADMIN_COOKIE);
  return { ok: true };
}

