import assert from "node:assert/strict";
import test from "node:test";
import { MIGRATION_LOCK_KEY, migrationGuard } from "./migrate-guard.mjs";

test("migrate guard refuses an empty or unconfirmed production database", () => {
  assert.equal(migrationGuard({}).ok, false);
  assert.equal(migrationGuard({ NODE_ENV: "production", DATABASE_URL: "postgres://db/app" }).ok, false);
  assert.equal(
    migrationGuard({ NODE_ENV: "production", DATABASE_URL: "postgres://db/app", SHAHOO_ALLOW_PRODUCTION_MIGRATE: "1" }).ok,
    true,
  );
  assert.equal(typeof MIGRATION_LOCK_KEY, "string");
  assert.match(MIGRATION_LOCK_KEY, /^\d+$/);
});
