import type { AppDatabase } from "../db/client";
import { auditLogs } from "../db/schema.ts";

export type AuditInput = {
  actorType: "customer" | "admin" | "anonymous" | "system";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

const SECRET_KEYS = new Set([
  "password",
  "passwordhash",
  "otp",
  "otpcode",
  "token",
  "sessiontoken",
  "accesstoken",
  "secret",
  "authorization",
  "cvv",
  "cardnumber",
]);

export function scrubAuditMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      clean[key] = value;
    }
  }
  return clean;
}

type AuditDb = { insert: AppDatabase["insert"] };

export async function writeAudit(db: AuditDb, entry: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    id: `aud-${crypto.randomUUID()}`,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: scrubAuditMetadata(entry.metadata),
  });
}
