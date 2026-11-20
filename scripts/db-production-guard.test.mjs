import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

function runNode(env, script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "--import", "./scripts/ts-alias-register.mjs", "--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("production startup throws without DATABASE_URL", async () => {
  const result = await runNode(
    { NODE_ENV: "production", DATABASE_URL: "" },
    "await import('./src/lib/db.ts'); console.log('started');",
  );
  assert.notEqual(result.code, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /DATABASE_URL is required/);
  assert.doesNotMatch(result.stdout, /started/);
});

test("a refused postgres connection does not become a successful pglite start", async () => {
  const result = await runNode(
    { NODE_ENV: "production", DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/none" },
    "import { getSql } from './src/lib/db.ts'; const sql = await getSql(); await sql`select 1`; console.log('connected');",
  );
  assert.notEqual(result.code, 0);
  assert.doesNotMatch(result.stdout, /connected/);
});

test("migrate exits before connecting when production confirmation is missing", async () => {
  const result = await runNode(
    { NODE_ENV: "production", DATABASE_URL: "postgres://127.0.0.1:1/none" },
    "await import('./scripts/migrate.mjs');",
  );
  assert.notEqual(result.code, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /SHAHOO_ALLOW_PRODUCTION_MIGRATE/);
});
