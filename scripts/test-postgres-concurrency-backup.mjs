#!/usr/bin/env node
/**
 * Disposable real-PostgreSQL verification for CI.
 * Clones only the empty, freshly migrated CI database into uniquely named
 * scratch databases, exercises row-lock contention through two independent
 * clients, then pg_dump/pg_restore round-trips the scratch database.
 * Refuses non-loopback hosts and any source database except shahoo_test.
 */
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import pg from "pg";

const execFileAsync = promisify(execFile);
const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) throw new Error("DATABASE_URL is required");
const baseUrl = new URL(rawUrl);
const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
const baseDatabase = decodeURIComponent(baseUrl.pathname.replace(/^\//, ""));
if (!loopback.has(baseUrl.hostname) || baseDatabase !== "shahoo_test") {
  throw new Error("Refusing to run: only the local CI shahoo_test database is accepted");
}
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const sourceDb = "shahoo_mc_" + suffix;
const restoreDb = "shahoo_restore_" + suffix;
const quoteIdent = (value) => '"' + value.replaceAll('"', '""') + '"';
const adminUrl = new URL(baseUrl);
adminUrl.pathname = "/postgres";
const sourceUrl = new URL(baseUrl);
sourceUrl.pathname = "/" + sourceDb;
const restoreUrl = new URL(baseUrl);
restoreUrl.pathname = "/" + restoreDb;
const workDir = await mkdtemp(join(tmpdir(), "shahoo-pg-verify-"));
const dumpPath = join(workDir, "shahoo-ci.dump");
const admin = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 10_000 });
let first, second, sourcePool, restorePool;
let createdSource = false, createdRestore = false;

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function clientEnv(database) {
  const env = { ...process.env, PGHOST: baseUrl.hostname, PGPORT: baseUrl.port || "5432",
    PGUSER: decodeURIComponent(baseUrl.username), PGDATABASE: database };
  if (baseUrl.password) env.PGPASSWORD = decodeURIComponent(baseUrl.password);
  else delete env.PGPASSWORD;
  const sslmode = baseUrl.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

async function main() {
  await admin.connect();
  await admin.query("CREATE DATABASE " + quoteIdent(sourceDb) + " TEMPLATE " + quoteIdent(baseDatabase));
  createdSource = true;

  first = new pg.Client({ connectionString: sourceUrl.toString(), connectionTimeoutMillis: 10_000 });
  second = new pg.Client({ connectionString: sourceUrl.toString(), connectionTimeoutMillis: 10_000 });
  await Promise.all([first.connect(), second.connect()]);
  await first.query("CREATE TABLE shahoo_ci_inventory_probe (id integer PRIMARY KEY, available integer NOT NULL CHECK (available >= 0))");
  await first.query("INSERT INTO shahoo_ci_inventory_probe (id, available) VALUES (1, 1)");

  await first.query("BEGIN");
  const locked = await first.query("SELECT available FROM shahoo_ci_inventory_probe WHERE id = 1 FOR UPDATE");
  if (locked.rows[0]?.available !== 1) throw new Error("Unexpected initial inventory value");
  await second.query("BEGIN");
  const secondLock = second.query("SELECT available FROM shahoo_ci_inventory_probe WHERE id = 1 FOR UPDATE");
  const waitState = await Promise.race([
    secondLock.then(() => "resolved"),
    delay(150).then(() => "blocked"),
  ]);
  if (waitState !== "blocked") {
    await secondLock;
    throw new Error("Second PostgreSQL connection did not wait on the first row lock");
  }
  const firstUpdate = await first.query("UPDATE shahoo_ci_inventory_probe SET available = available - 1 WHERE id = 1 AND available >= 1");
  if (firstUpdate.rowCount !== 1) throw new Error("First checkout simulation did not reserve stock");
  await first.query("COMMIT");
  const secondLocked = await secondLock;
  const secondAvailable = secondLocked.rows[0]?.available;
  const secondUpdate = await second.query("UPDATE shahoo_ci_inventory_probe SET available = available - 1 WHERE id = 1 AND available >= 1");
  await second.query("ROLLBACK");
  if (secondAvailable !== 0 || secondUpdate.rowCount !== 0) throw new Error("Concurrent checkout simulation allowed overselling");

  await Promise.all([first.end(), second.end()]);
  first = undefined; second = undefined;

  sourcePool = new pg.Pool({ connectionString: sourceUrl.toString(), max: 1 });
  const sourceResult = await sourcePool.query(
    "SELECT (SELECT count(*)::int FROM _migrations) AS migration_count, " +
    "(SELECT available FROM shahoo_ci_inventory_probe WHERE id = 1) AS available, " +
    "(SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public') AS public_index_count",
  );
  if (sourceResult.rows[0].migration_count < 1 || sourceResult.rows[0].available !== 0) {
    throw new Error("Scratch database does not contain expected migration and concurrency results");
  }
  await sourcePool.end(); sourcePool = undefined;

  await execFileAsync("docker", [
    "run", "--rm", "--network", "host",
    "-e", "PGHOST", "-e", "PGPORT", "-e", "PGUSER", "-e", "PGPASSWORD", "-e", "PGDATABASE",
    "-v", workDir + ":/backup", "postgres:16",
    "pg_dump", "--format=custom", "--no-owner", "--no-acl",
    "--file", "/backup/shahoo-ci.dump", "--dbname", sourceDb,
  ], { env: clientEnv(sourceDb), timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });

  await admin.query("CREATE DATABASE " + quoteIdent(restoreDb) + " TEMPLATE template0");
  createdRestore = true;
  await execFileAsync("docker", [
    "run", "--rm", "--network", "host",
    "-e", "PGHOST", "-e", "PGPORT", "-e", "PGUSER", "-e", "PGPASSWORD", "-e", "PGDATABASE",
    "-v", workDir + ":/backup", "postgres:16",
    "pg_restore", "--exit-on-error", "--no-owner", "--no-acl",
    "--dbname", restoreDb, "/backup/shahoo-ci.dump",
  ], { env: clientEnv(restoreDb), timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });

  restorePool = new pg.Pool({ connectionString: restoreUrl.toString(), max: 1 });
  const restored = await restorePool.query(
    "SELECT (SELECT count(*)::int FROM _migrations) AS migration_count, " +
    "(SELECT available FROM shahoo_ci_inventory_probe WHERE id = 1) AS available, " +
    "(SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public') AS public_index_count",
  );
  if (restored.rows[0].migration_count !== sourceResult.rows[0].migration_count ||
      restored.rows[0].available !== 0 ||
      restored.rows[0].public_index_count !== sourceResult.rows[0].public_index_count) {
    throw new Error("Restored database verification did not match the source");
  }
  console.log("[postgres-deep-check] PASS — independent row-lock contention prevented overselling; " +
    "pg_dump/pg_restore preserved " + restored.rows[0].migration_count + " migrations plus schema/index/data probes");
}

try {
  await main();
} finally {
  await Promise.allSettled([first?.end(), second?.end(), sourcePool?.end(), restorePool?.end()]);
  try { await admin.end(); } catch { /* May not have connected. */ }
  try {
    const cleanup = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5_000 });
    await cleanup.connect();
    if (createdSource) {
      await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [sourceDb]);
      await cleanup.query("DROP DATABASE IF EXISTS " + quoteIdent(sourceDb));
    }
    if (createdRestore) {
      await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [restoreDb]);
      await cleanup.query("DROP DATABASE IF EXISTS " + quoteIdent(restoreDb));
    }
    await cleanup.end();
  } catch (error) {
    console.error("[postgres-deep-check] cleanup failed; CI service is disposable:", error?.message || error);
    process.exitCode = 1;
  }
  await rm(workDir, { recursive: true, force: true });
}
