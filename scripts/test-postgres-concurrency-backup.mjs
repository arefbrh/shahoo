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
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/server/db/schema.ts";
import { commitCheckout } from "../src/server/commerce/checkout.ts";
import { releaseExpiredHolds } from "../src/server/commerce/holds.ts";
import { captureVerifiedPayment } from "../src/server/payments/service.ts";
import { moveOrderStatus } from "../src/server/commerce/fulfillment.ts";

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
  // Exercise the real application checkout transaction on this isolated clone.
  const appPool = new pg.Pool({ connectionString: sourceUrl.toString(), max: 4 });
  try {
    const appDb = drizzle(appPool, { schema });
    await appPool.query(`
      INSERT INTO product_categories (id, slug, name, short_name, is_active)
        VALUES ('ci-cat', 'ci-natural', 'Natural', 'Natural', true);
      INSERT INTO products (id, category_id, slug, sku, name, status)
        VALUES ('ci-prod', 'ci-cat', 'ci-oil', 'CI-PROD', 'CI Oil', 'published');
      INSERT INTO product_variants (id, product_id, sku, label, price_irr, status)
        VALUES ('ci-var', 'ci-prod', 'CI-VAR', 'Bottle', 100000, 'active');
      INSERT INTO inventory (variant_id, on_hand, reserved, low_stock_threshold)
        VALUES ('ci-var', 3, 0, 1);
      INSERT INTO shipping_methods (id, key, title, price_irr, is_active)
        VALUES ('ci-ship', 'ci-post', 'CI Post', 0, true);
      INSERT INTO customers (id, mobile, full_name, status)
        VALUES ('ci-customer-a', '09120000001', 'CI Customer A', 'active'),
               ('ci-customer-b', '09120000002', 'CI Customer B', 'active');
      INSERT INTO admin_users (id, email, full_name, status)
        VALUES ('ci-admin', 'ci-admin@example.invalid', 'CI Admin', 'active');
      INSERT INTO carts (id, customer_id) VALUES ('ci-cart-a', 'ci-customer-a'), ('ci-cart-b', 'ci-customer-b');
      INSERT INTO cart_items (id, cart_id, variant_id, quantity)
        VALUES ('ci-line-a', 'ci-cart-a', 'ci-var', 2),
               ('ci-line-b', 'ci-cart-b', 'ci-var', 2);
    `);
    const common = {
      fullName: 'CI Buyer', mobile: '09120000001', province: 'تهران', city: 'تهران',
      addressLine: 'CI Test Address', postalCode: '1234567890', plaque: '1', unit: '1',
      customerNote: '', shippingMethodId: 'ci-ship', couponCode: '', addressId: null,
    };
    const outcomes = await Promise.all([
      commitCheckout(appDb, { ...common, idempotencyKey: 'ci-checkout-a' },
        { id: 'ci-cart-a', customerId: 'ci-customer-a', buyerKey: 'c:ci-customer-a' },
        { id: 'ci-customer-a', fullName: 'CI Customer A', mobile: '09120000001' }),
      commitCheckout(appDb, { ...common, idempotencyKey: 'ci-checkout-b', mobile: '09120000002' },
        { id: 'ci-cart-b', customerId: 'ci-customer-b', buyerKey: 'c:ci-customer-b' },
        { id: 'ci-customer-b', fullName: 'CI Customer B', mobile: '09120000002' }),
    ]);
    if (outcomes.filter((x) => x.ok).length !== 1 || outcomes.filter((x) => !x.ok).length !== 1) {
      throw new Error('Application checkout race did not produce exactly one success and one safe rejection: ' + JSON.stringify(outcomes));
    }
    const appState = await appPool.query(`
      SELECT (SELECT count(*)::int FROM orders WHERE idempotency_key IN ('ci-checkout-a','ci-checkout-b')) AS orders,
             (SELECT reserved FROM inventory WHERE variant_id='ci-var') AS reserved,
             (SELECT count(*)::int FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE idempotency_key IN ('ci-checkout-a','ci-checkout-b'))) AS order_items,
             (SELECT count(*)::int FROM cart_items WHERE cart_id IN ('ci-cart-a','ci-cart-b')) AS remaining_lines
    `);
    const state = appState.rows[0];
    if (state.orders !== 1 || state.reserved !== 2 || state.order_items !== 1 || state.remaining_lines !== 1) {
      throw new Error('Application checkout race left inconsistent state: ' + JSON.stringify(state));
    }
    const createdOrder = await appPool.query(
      "SELECT id FROM orders WHERE idempotency_key IN ('ci-checkout-a','ci-checkout-b')",
    );
    if (createdOrder.rowCount !== 1) throw new Error('Expected exactly one checkout order before hold expiry test');
    const checkoutOrderId = createdOrder.rows[0].id;
    await appPool.query(
      "UPDATE orders SET stock_hold_until = NOW() - INTERVAL '1 minute' WHERE id = $1",
      [checkoutOrderId],
    );
    const releaseResults = await Promise.all([
      releaseExpiredHolds(appDb),
      releaseExpiredHolds(appDb),
    ]);
    if (releaseResults[0] + releaseResults[1] !== 1) {
      throw new Error('Concurrent expired-hold workers did not release exactly one order: ' + JSON.stringify(releaseResults));
    }
    const releasedState = await appPool.query(
      `SELECT o.status, o.stock_state, i.on_hand, i.reserved,
              (SELECT count(*)::int FROM order_events e WHERE e.order_id = o.id AND e.status = 'expired') AS expired_events,
              (SELECT count(*)::int FROM audit_logs a WHERE a.entity_id = o.id AND a.action = 'order.hold_released') AS release_audits
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       JOIN inventory i ON i.variant_id = oi.variant_id WHERE o.id = $1`,
      [checkoutOrderId],
    );
    const released = releasedState.rows[0];
    if (!released || released.status !== 'expired' || released.stock_state !== 'released' ||
        released.on_hand !== 3 || released.reserved !== 0 ||
        released.expired_events !== 1 || released.release_audits !== 1) {
      throw new Error('Expired-hold release left inconsistent state: ' + JSON.stringify(released));
    }
    const localVerifiedProvider = {
      key: 'payping',
      configured: () => true,
      async createIntent(input) { return { authority: 'ci-local-' + input.idempotencyKey }; },
      async verify(input) { return { ok: true, referenceId: 'ci-local-reference-' + input.authority }; },
    };
    const paymentResults = await Promise.all([
      captureVerifiedPayment(appDb, {
        orderId: checkoutOrderId, idempotencyKey: 'ci-payment-capture-once',
        token: 'ci-local-token', provider: localVerifiedProvider,
      }),
      captureVerifiedPayment(appDb, {
        orderId: checkoutOrderId, idempotencyKey: 'ci-payment-capture-once',
        token: 'ci-local-token', provider: localVerifiedProvider,
      }),
    ]);
    if (paymentResults.filter((x) => x.ok).length !== 1) {
      throw new Error('Concurrent payment capture did not produce exactly one success: ' + JSON.stringify(paymentResults));
    }
    const capturedState = await appPool.query(
      `SELECT o.status, o.payment_status, o.stock_state, i.on_hand, i.reserved,
              (SELECT count(*)::int FROM payments p WHERE p.order_id = o.id AND p.status = 'verified') AS verified_payments,
              (SELECT count(*)::int FROM payment_logs pl JOIN payments p ON p.id = pl.payment_id WHERE p.order_id = o.id AND pl.event = 'verified') AS verified_logs,
              (SELECT count(*)::int FROM order_events e WHERE e.order_id = o.id AND e.status = 'paid') AS paid_events,
              (SELECT count(*)::int FROM audit_logs a WHERE a.entity_id = o.id AND a.action = 'payment.verified') AS payment_audits
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       JOIN inventory i ON i.variant_id = oi.variant_id WHERE o.id = $1`,
      [checkoutOrderId],
    );
    const captured = capturedState.rows[0];
    if (!captured || captured.status !== 'paid' || captured.payment_status !== 'verified' ||
        captured.stock_state !== 'captured' || captured.on_hand !== 1 || captured.reserved !== 0 ||
        captured.verified_payments !== 1 || captured.verified_logs !== 1 ||
        captured.paid_events !== 1 || captured.payment_audits !== 1) {
      throw new Error('Concurrent payment capture left inconsistent state: ' + JSON.stringify(captured));
    }
    // Exercise the real order-transition transaction under two concurrent cancellation requests.
    await appPool.query("UPDATE inventory SET on_hand = 3, reserved = 1 WHERE variant_id = 'ci-var'");
    await appPool.query(`
      INSERT INTO orders (
        id, public_code, status, full_name, mobile, province, city, address_line,
        subtotal_irr, total_irr, payment_status, stock_state, stock_hold_until
      ) VALUES (
        'ci-cancel-order', 'SH-20261120-CANCEL', 'awaiting_payment', 'CI Buyer',
        '09120000001', 'تهران', 'تهران', 'CI cancellation address',
        100000, 100000, 'unpaid', 'held', NOW() + INTERVAL '1 hour'
      );
      INSERT INTO order_items (
        id, order_id, variant_id, product_name, variant_label, sku, quantity, unit_price_irr, line_total_irr
      ) VALUES (
        'ci-cancel-item', 'ci-cancel-order', 'ci-var', 'CI Oil', 'Bottle', 'CI-VAR',
        1, 100000, 100000
      );
    `);
    const cancellationResults = await Promise.all([
      moveOrderStatus(appDb, 'ci-admin', 'SH-20261120-CANCEL', 'cancelled', 'CI concurrent cancellation'),
      moveOrderStatus(appDb, 'ci-admin', 'SH-20261120-CANCEL', 'cancelled', 'CI concurrent cancellation'),
    ]);
    if (cancellationResults.filter((x) => x.ok).length !== 1 ||
        cancellationResults.filter((x) => !x.ok).length !== 1) {
      throw new Error('Concurrent order cancellation did not produce exactly one transition: ' + JSON.stringify(cancellationResults));
    }
    const cancelledState = await appPool.query(`
      SELECT o.status, o.stock_state, i.on_hand, i.reserved,
             (SELECT count(*)::int FROM order_events e WHERE e.order_id = o.id AND e.status = 'cancelled') AS cancel_events,
             (SELECT count(*)::int FROM inventory_logs l WHERE l.order_id = o.id AND l.reason = 'release_cancelled') AS release_logs,
             (SELECT count(*)::int FROM audit_logs a WHERE a.entity_id = o.id AND a.action = 'order.status') AS status_audits,
             (SELECT count(*)::int FROM notifications n WHERE n.order_id = o.id AND n.event_key = 'order.status') AS status_notices
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      JOIN inventory i ON i.variant_id = oi.variant_id WHERE o.id = 'ci-cancel-order'
    `);
    const cancelled = cancelledState.rows[0];
    if (!cancelled || cancelled.status !== 'cancelled' || cancelled.stock_state !== 'released' ||
        cancelled.on_hand !== 3 || cancelled.reserved !== 0 ||
        cancelled.cancel_events !== 1 || cancelled.release_logs !== 1 ||
        cancelled.status_audits !== 1 || cancelled.status_notices !== 1) {
      throw new Error('Concurrent order cancellation left inconsistent state: ' + JSON.stringify(cancelled));
    }
    console.log('[postgres-app-order-transition] PASS — concurrent cancellation requests committed one transition, one stock release, one event, one audit and one notice');
    console.log('[postgres-app-payment-capture] PASS — two concurrent verified captures for an expired order recovered stock and committed one payment, one stock decrement, one paid event and one audit');
    console.log('[postgres-app-hold-release] PASS — two concurrent workers released one expired unpaid order exactly once; reserved stock, order event and audit stayed consistent');
    console.log('[postgres-app-checkout] PASS — real commitCheckout with two independent customer carts competing for two units: one order committed, one rejected, stock reservation remained exactly 2, no oversell');
  } finally {
    await appPool.end();
  }

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
