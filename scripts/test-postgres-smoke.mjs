#!/usr/bin/env node
/**
 * Real PostgreSQL smoke checks for CI.
 *
 * This intentionally does not import the application DB singleton or call
 * getPglite(): it verifies the database selected by DATABASE_URL itself.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[postgres-smoke] DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 10_000,
});

const requiredTables = [
  "customers",
  "products",
  "orders",
  "payments",
  "payment_attempts",
  "inventory",
  "carts",
  "cart_items",
];

async function main() {
  const client = await pool.connect();
  try {
    const version = await client.query("SELECT current_setting('server_version_num')::int AS version_num");
    if (version.rows[0].version_num < 140000) {
      throw new Error("PostgreSQL 14 or newer is required");
    }

    const migrations = await client.query(
      "SELECT count(*)::int AS count FROM _migrations",
    );
    if (migrations.rows[0].count < 1) {
      throw new Error("No applied migrations were recorded in _migrations");
    }

    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'",
    );
    const present = new Set(tables.rows.map((row) => row.table_name));
    const missing = requiredTables.filter((name) => !present.has(name));
    if (missing.length) {
      throw new Error(`Required application tables are missing: ${missing.join(", ")}`);
    }

    await client.query("BEGIN");
    await client.query("CREATE TEMP TABLE shahoo_ci_rollback_probe (id integer PRIMARY KEY)");
    await client.query("INSERT INTO shahoo_ci_rollback_probe (id) VALUES ($1)", [1]);
    const probe = await client.query("SELECT id FROM shahoo_ci_rollback_probe WHERE id = $1", [1]);
    if (probe.rows[0]?.id !== 1) {
      throw new Error("Parameterized PostgreSQL query returned an unexpected result");
    }
    await client.query("ROLLBACK");

    const rolledBack = await client.query(
      "SELECT to_regclass('pg_temp.shahoo_ci_rollback_probe') IS NULL AS rolled_back",
    );
    if (rolledBack.rows[0]?.rolled_back !== true) {
      throw new Error("PostgreSQL transaction rollback did not remove the temporary probe");
    }

    console.log(
      `[postgres-smoke] OK — PostgreSQL ${version.rows[0].version_num}, ${migrations.rows[0].count} migration(s), ${requiredTables.length} required tables, parameterized query and rollback verified`,
    );
  } finally {
    client.release();
  }
}

try {
  await main();
} catch (error) {
  console.error("[postgres-smoke] failed:", error?.message || error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
