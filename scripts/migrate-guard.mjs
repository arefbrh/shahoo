/**
 * Shared migrate preconditions. Kept free of a database connection so the
 * production guard can be tested without credentials.
 */

export function migrationGuard(env = process.env) {
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    return { ok: false, message: "DATABASE_URL is required to migrate. Refusing to skip or fall back to PGlite." };
  }
  if (env.NODE_ENV === "production" && env.SHAHOO_ALLOW_PRODUCTION_MIGRATE !== "1") {
    return {
      ok: false,
      message: "Production migration requires SHAHOO_ALLOW_PRODUCTION_MIGRATE=1 in addition to DATABASE_URL.",
    };
  }
  return { ok: true, databaseUrl };
}

/** Stable 64-bit key for pg_advisory_lock. Not a secret. */
export const MIGRATION_LOCK_KEY = "814774531042";
