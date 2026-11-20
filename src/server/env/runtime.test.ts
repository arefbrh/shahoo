import assert from "node:assert/strict";
import test from "node:test";
import {
  connectionErrorUsesPglite,
  demoSeedAllowed,
  devCspAllowed,
  migrationGuard,
  mockPaymentAllowed,
  mockSmsAllowed,
  otpEchoAllowed,
  resolveDatabasePlan,
  validateProductionEnv,
} from "./runtime.ts";

test("production database configuration fails closed", () => {
  const dev = resolveDatabasePlan({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
  assert.equal(dev.ok && dev.source, "pglite");
  const testEnv = resolveDatabasePlan({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
  assert.equal(testEnv.ok && testEnv.source, "pglite");
  const missing = resolveDatabasePlan({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
  assert.equal(missing.ok, false);
  const blank = resolveDatabasePlan({ NODE_ENV: "production", DATABASE_URL: "   " } as NodeJS.ProcessEnv);
  assert.equal(blank.ok, false);
  const configured = resolveDatabasePlan({ NODE_ENV: "production", DATABASE_URL: "postgres://local/shahoo" } as NodeJS.ProcessEnv);
  assert.equal(configured.ok && configured.source, "postgres");
  const devUrl = resolveDatabasePlan({ NODE_ENV: "development", DATABASE_URL: "postgres://local/shahoo" } as NodeJS.ProcessEnv);
  assert.equal(devUrl.ok && devUrl.source, "postgres");
  assert.equal(validateProductionEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv).ok, false);
  assert.equal(validateProductionEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://local/shahoo" } as NodeJS.ProcessEnv).ok, true);
  assert.equal(connectionErrorUsesPglite(), false);
});

test("demo seed and development flags cannot turn on in production", () => {
  assert.equal(demoSeedAllowed({ NODE_ENV: "production", SEED_DEMO: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(demoSeedAllowed({ NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
  assert.equal(demoSeedAllowed({ NODE_ENV: "development", SEED_DEMO: "1" } as NodeJS.ProcessEnv), true);
  assert.equal(otpEchoAllowed({ NODE_ENV: "production", ECHO_OTP: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(otpEchoAllowed({ NODE_ENV: "development", ECHO_OTP: "1" } as NodeJS.ProcessEnv), true);
  assert.equal(otpEchoAllowed({ NODE_ENV: "development", ECHO_OTP: "1", SMS_PROVIDER: "smsir", SMS_IR_API_KEY: "set", SMS_IR_OTP_TEMPLATE_ID: "123" } as NodeJS.ProcessEnv), false);
  assert.equal(otpEchoAllowed({ NODE_ENV: "development", ECHO_OTP: "1", SMS_PROVIDER: "mock" } as NodeJS.ProcessEnv), false);
  assert.equal(mockPaymentAllowed({ NODE_ENV: "production", ALLOW_MOCK_PAYMENT: "1", PAYMENT_PROVIDER: "mock" } as NodeJS.ProcessEnv), false);
  assert.equal(mockPaymentAllowed({ NODE_ENV: "test", PAYMENT_PROVIDER: "mock" } as NodeJS.ProcessEnv), false);
  assert.equal(mockPaymentAllowed({ NODE_ENV: "test", ALLOW_MOCK_PAYMENT: "1", PAYMENT_PROVIDER: "mock" } as NodeJS.ProcessEnv), true);
  assert.equal(devCspAllowed({ NODE_ENV: "production", ALLOW_DEV_CSP: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(devCspAllowed({ NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
  assert.equal(devCspAllowed({ NODE_ENV: "development", ALLOW_DEV_CSP: "1" } as NodeJS.ProcessEnv), true);
  assert.equal(mockSmsAllowed({ NODE_ENV: "production", ALLOW_MOCK_SMS: "1", SMS_PROVIDER: "mock" } as NodeJS.ProcessEnv), false);
  assert.equal(mockSmsAllowed({ NODE_ENV: "development", SMS_PROVIDER: "mock" } as NodeJS.ProcessEnv), false);
  assert.equal(mockSmsAllowed({ NODE_ENV: "development", ALLOW_MOCK_SMS: "1", SMS_PROVIDER: "mock" } as NodeJS.ProcessEnv), true);
});

test("migration requires a database and an explicit production confirmation", () => {
  assert.equal(migrationGuard({} as NodeJS.ProcessEnv).ok, false);
  assert.equal(migrationGuard({ NODE_ENV: "production", DATABASE_URL: "postgres://local/shahoo" } as NodeJS.ProcessEnv).ok, false);
  const allowed = migrationGuard({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://local/shahoo",
    SHAHOO_ALLOW_PRODUCTION_MIGRATE: "1",
  } as NodeJS.ProcessEnv);
  assert.equal(allowed.ok && allowed.databaseUrl, "postgres://local/shahoo");
  const dev = migrationGuard({ DATABASE_URL: "postgres://local/shahoo" } as NodeJS.ProcessEnv);
  assert.equal(dev.ok, true);
});
