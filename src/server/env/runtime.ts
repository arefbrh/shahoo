/**
 * Process environment policy for SHAHOO.
 * Pure and side-effect free so tests can cover the matrix without a database.
 * Production fails closed. Demo catalog data may be explicitly seeded on Vercel Preview only.
 */

export type DatabasePlan =
  | { ok: true; source: "postgres"; databaseUrl: string }
  | { ok: true; source: "pglite"; databaseUrl: null }
  | { ok: false; message: string };

const PRODUCTION_DB_MESSAGE =
  "DATABASE_URL is required when NODE_ENV=production. SHAHOO will not start on embedded PGlite.";

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

/** Configuration only. Does not open a connection. */
export function resolveDatabasePlan(env: NodeJS.ProcessEnv = process.env): DatabasePlan {
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (isProductionEnv(env)) {
    if (!databaseUrl) return { ok: false, message: PRODUCTION_DB_MESSAGE };
    return { ok: true, source: "postgres", databaseUrl };
  }
  if (databaseUrl) return { ok: true, source: "postgres", databaseUrl };
  return { ok: true, source: "pglite", databaseUrl: null };
}

/**
 * A postgres connection error must stay a postgres failure.
 * Callers must not switch the process onto PGlite after this returns.
 */
export function connectionErrorUsesPglite(): false {
  return false;
}

/**
 * Demo catalog seeding is opt-in in development and on Vercel Preview only.
 * Vercel Preview runs with NODE_ENV=production, so VERCEL_ENV is the
 * additional deployment boundary. Production deployments can never opt in.
 */
export function demoSeedAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SEED_DEMO !== "1") return false;
  if (env.VERCEL_ENV === "preview") return true;
  return !isProductionEnv(env);
}

/** OTP plaintext may be returned to the browser only with an explicit non-production flag and no SMS provider. */
export function otpEchoAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionEnv(env)) return false;
  if (env.ECHO_OTP !== "1") return false;
  if (env.SMS_MODE?.trim().toLowerCase() && env.SMS_MODE.trim().toLowerCase() !== "disabled") return false;
  return !(env.SMS_PROVIDER?.trim() || env.SMS_API_KEY?.trim() || env.SMS_IR_API_KEY?.trim());
}

export function mockPaymentAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionEnv(env)) return false;
  return env.ALLOW_MOCK_PAYMENT === "1" && env.PAYMENT_PROVIDER?.trim().toLowerCase() === "mock";
}

export function devCspAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionEnv(env)) return false;
  return env.ALLOW_DEV_CSP === "1";
}

export function mockSmsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionEnv(env)) return false;
  return env.ALLOW_MOCK_SMS === "1" && env.SMS_PROVIDER?.trim().toLowerCase() === "mock";
}

export function migrationGuard(env: NodeJS.ProcessEnv = process.env): { ok: true; databaseUrl: string } | { ok: false; message: string } {
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    return { ok: false, message: "DATABASE_URL is required to migrate. Refusing to skip or fall back to PGlite." };
  }
  if (isProductionEnv(env) && env.SHAHOO_ALLOW_PRODUCTION_MIGRATE !== "1") {
    return {
      ok: false,
      message: "Production migration requires SHAHOO_ALLOW_PRODUCTION_MIGRATE=1 in addition to DATABASE_URL.",
    };
  }
  return { ok: true, databaseUrl };
}

/** Names checked at production startup. Values are never included in errors. */
export const PRODUCTION_REQUIRED_ENV = ["DATABASE_URL"] as const;

export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): { ok: true } | { ok: false; message: string } {
  if (!isProductionEnv(env)) return { ok: true };
  const plan = resolveDatabasePlan(env);
  if (!plan.ok) return plan;
  return { ok: true };
}
