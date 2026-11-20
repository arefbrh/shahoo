# PostgreSQL verification — SHAHOO v1.0.0 Batch 09 final remediation

> **PARTIALLY EXECUTED — SEE CI ADDENDUM.** PR #6 CI run `44729304066` successfully exercised a freshly migrated PostgreSQL 16 CI service, independent-connection row-lock contention, the real application `commitCheckout`, concurrent `releaseExpiredHolds`, concurrent `captureVerifiedPayment`, and a native `pg_dump`/`pg_restore` round trip on synthetic data. The broader fresh/upgrade, payment/expiry/order-transition and production-like disaster-recovery procedures below remain future verification work. This is a checklist for a future, explicitly authorized operator using synthetic data; the final host has not been selected. No live integration or production database is touched by preparing this document.

## Scope and safeguards

- Run from the project root in a disposable, single-user isolated machine with Docker Engine, Bash, OpenSSL, PostgreSQL client tools (`psql`, `pg_isready`, `createdb`, `pg_dump`, `pg_restore`), Node and `npm ci` dependencies. Use a PostgreSQL 16 client or a newer compatible client; `pg_dump` must not be older than the server major version. Record exact image digest, server/client/Node versions and results. The sample image tag is not an immutable pin; record/pin the approved digest for exact reproduction.
- The example starts an ephemeral database, creates and later destroys databases and a container. **Never** target production, customer data, a shared database, a real host, or a remotely accessible Docker daemon. Confirm the selected container name, port, and current `PG*` configuration. Use synthetic fixtures only. Review every command before executing. Stop on any failed command; record sanitized output and exit codes without secrets or personal data.
- The Revision 02 report's illustrative `-p 55432:5432` binds all interfaces by default and its fixed `test` password/URL can be exposed in shell history, process arguments or logs. Do not use that example. The replacement below binds explicitly to `127.0.0.1`, uses a random disposable password file, a private `PGPASSFILE` for both libpq tools and the installed `pg`/`pgpass` driver, and never places the password in the URI or Docker command line. A localhost port is accessible to local users; Docker access, other containers, host privileges and port publishing/firewall behavior must be isolated too. This is not production security or an internet-facing configuration.
- Disable shell tracing and CI debug logging. Do not display the secret file in the terminal, run `env`/`docker inspect` into evidence, paste credentials into a URL, or capture SQL/application logs containing tokens. File mode 0600 matters; wipe test files and stop the container afterward. For real remote staging, separately configure verified TLS and provider-approved secret handling; never reuse this local no-TLS example.
- **Existing test limitation:** many app suites instantiate `PGlite` directly or call `getPglite()`; simply exporting `DATABASE_URL` does not convert them into PostgreSQL tests and may make some fail. `scripts/pg-media-race.sh` exists for a **SQL-only media** race, applies only 0002–0008 in its own database, and does not call the application TypeScript. It is not an inventory/payment/cart harness and its result cannot prove app integration or current migration coverage.

## 1. Disposable server and credentials

Execute the blocks in order in the same dedicated Bash shell from the project root, only after the safeguards above. Check that port 55432 is free. The container is removed when stopped; its data directory is tmpfs. This command sequence needs Docker permission and a local client installation. `set -e` stops after a failing simple command; if the shell exits, use the printed disposable container and private-directory names to inspect and clean up manually. If any prerequisite fails, stop; do not change target to an existing database.

```bash
set +x
set -e
umask 077
unset DATABASE_URL PGPASSWORD PGSERVICE PGSERVICEFILE PGHOSTADDR PGOPTIONS
RUN_DIR=$(mktemp -d "${TMPDIR:-/tmp}/shahoo-pg-XXXXXXXX")
PG_CONTAINER="shahoo-test-$(basename "$RUN_DIR")"
printf 'Disposable container: %s\nPrivate directory: %s\n' "$PG_CONTAINER" "$RUN_DIR"
openssl rand -hex 32 > "$RUN_DIR/password"
# The password is read into the Bash built-in printf, not placed in command history.
printf '127.0.0.1:55432:*:shahoo_test:%s\n' "$(cat "$RUN_DIR/password")" > "$RUN_DIR/pgpass"
chmod 600 "$RUN_DIR/password" "$RUN_DIR/pgpass"
export PGHOST=127.0.0.1 PGPORT=55432 PGUSER=shahoo_test PGDATABASE=postgres
export PGPASSFILE="$RUN_DIR/pgpass" PGCONNECT_TIMEOUT=5 PGSSLMODE=disable PGTZ=UTC

docker run -d --rm --name "$PG_CONTAINER" \
  -e POSTGRES_USER=shahoo_test -e POSTGRES_DB=postgres \
  -e POSTGRES_PASSWORD_FILE=/run/pg-password \
  --mount "type=bind,source=$RUN_DIR/password,target=/run/pg-password,readonly" \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,size=512m \
  -p 127.0.0.1:55432:5432 postgres:16

for attempt in $(seq 1 60); do
  if pg_isready -q -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres; then break; fi
  sleep 1
done
pg_isready -q -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres || { echo 'Server not ready; stop.' >&2; exit 1; }
# Readiness alone does not check credentials: this must also succeed.
psql -X -w -v ON_ERROR_STOP=1 -d postgres -c 'SELECT current_user, current_database(), version();'
```

The official container's `POSTGRES_PASSWORD_FILE` is read at initialization; if the local Docker platform cannot read the bind-mounted file, stop and fix permissions safely. Do not turn on `trust` or print the password. `PGPASSFILE` is supported by the installed `pgpass` dependency used by this version of `pg`; recheck if the driver is changed. A port conflict, other local user or reachable container is a reason to stop and isolate, not to reuse an unknown database. `-w` prevents credential prompts and unintended interactive fallbacks.

## 2. Fresh migration and idempotence — executable DB checks

`NODE_ENV=development` here is deliberately used only with this disposable PostgreSQL; production migrations additionally require `SHAHOO_ALLOW_PRODUCTION_MIGRATE=1`. `scripts/migrate.mjs` discovers only root `migrations/*.sql` and tracks basenames, so the Better Auth file in `migrations/auth/` is **not** applied. For this source the expected root set is 15 files: `0002_shahoo_foundation.sql` through `0012_batch_07_inventory_audit.sql`, followed by `0013_batch_09_payment_attempts.sql`, `0014_batch_09_payment_attempt_guards.sql`, `0015_batch_09_manual_review_guard.sql`, and `0016_batch_09_verification_recovery.sql`. The nested `migrations/auth/0001_auth.sql` is outside the root migrator.

```bash
createdb -w shahoo_fresh
export NODE_ENV=development VITE_AUTH_ENABLED=false
unset SHAHOO_ALLOW_PRODUCTION_MIGRATE
export DATABASE_URL='postgresql://shahoo_test@127.0.0.1:55432/shahoo_fresh'
npm run db:migrate
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_fresh -c '\d _migrations'
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_fresh -c 'SELECT name, applied_at FROM _migrations ORDER BY name;'
# Compare exact filenames and verify a rerun did not change migration timestamps.
printf '%s\n' migrations/*.sql | sed 's|.*/||' | LC_ALL=C sort > "$RUN_DIR/expected-migrations"
test "$(wc -l < "$RUN_DIR/expected-migrations")" -eq 15
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_fresh -Atc 'SELECT name FROM _migrations ORDER BY name COLLATE "C"' > "$RUN_DIR/fresh-migrations"
diff -u "$RUN_DIR/expected-migrations" "$RUN_DIR/fresh-migrations"
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_fresh -Atc 'SELECT name, applied_at FROM _migrations ORDER BY name COLLATE "C"' > "$RUN_DIR/before-rerun"
npm run db:migrate
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_fresh -Atc 'SELECT name, applied_at FROM _migrations ORDER BY name COLLATE "C"' > "$RUN_DIR/after-rerun"
diff -u "$RUN_DIR/before-rerun" "$RUN_DIR/after-rerun"
```

Expected `_migrations` schema: `name TEXT PRIMARY KEY`, `applied_at TIMESTAMPTZ NOT NULL DEFAULT now()`; no `version`, `id` or `filename` column. Confirm 15 root entries for this snapshot and a second `up to date` message. Also inspect `\dt`, relevant tables, partial indexes and constraints. A filename diff proves recorded names match files, not that SQL content was never edited; capture source archive identity/checksums separately.

## Batch 09 payment migration checks

The fresh and upgrade procedures must verify `payment_attempts`, `provider_amount_toman`, `verification_payment_ref_id`, the one-active-attempt partial index, and the `manual_review` predicate. Before applying `0014`, inspect existing attempts for non-divisible IRR amounts; the migration must stop rather than guess. `0016` is additive and preserves existing payment records. These checks remain prepared, not executed against a real PostgreSQL server in this environment.

## 3. Upgrade migration on a synthetic pre-0011 database

This builds a **representative simulation**, not a historical production backup or proof of every upgrade path. It uses `psql` to install 0002–0010 and records each filename in the exact tracking schema in the **same transaction** as that file. The current migrator then applies pending migrations 0011 through 0016, including the four Batch 09 payment-attempt migrations. Keep the source migration files unchanged. No application start is needed.

```bash
createdb -w shahoo_upgrade
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_upgrade -c \
  'CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
for f in migrations/000[2-9]_*.sql migrations/0010_*.sql; do
  test -f "$f" || { echo "Missing migration: $f" >&2; exit 1; }
  name=$(basename "$f")
  psql -X -w -v ON_ERROR_STOP=1 --single-transaction -d shahoo_upgrade \
    -f "$f" -c "INSERT INTO _migrations (name) VALUES ('$name')"
done
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_upgrade <<'SQL'
INSERT INTO customers (id, mobile, full_name) VALUES ('legacy-customer', '09120000001', 'Synthetic Customer');
INSERT INTO customer_addresses (id, customer_id, province, city, address_line, is_default, updated_at)
VALUES ('legacy-old', 'legacy-customer', 'Synthetic', 'Synthetic', 'Old address', true, '2024-01-01T00:00:00Z'),
       ('legacy-new', 'legacy-customer', 'Synthetic', 'Synthetic', 'New address', true, '2024-02-01T00:00:00Z');
INSERT INTO product_categories (id, slug, name, short_name) VALUES ('legacy-cat', 'legacy-cat', 'Synthetic', 'Synthetic');
INSERT INTO products (id, category_id, slug, sku, name, status) VALUES ('legacy-product', 'legacy-cat', 'legacy-product', 'LEGACY-P', 'Synthetic', 'published');
INSERT INTO product_variants (id, product_id, sku, label, price_irr) VALUES ('legacy-variant', 'legacy-product', 'LEGACY-V', 'Synthetic', 1000);
INSERT INTO inventory (variant_id, on_hand, reserved) VALUES ('legacy-variant', 5, 0);
INSERT INTO inventory_logs (id, variant_id, delta, reason) VALUES ('legacy-log', 'legacy-variant', 5, 'opening_balance');
INSERT INTO homepage_sections (id, section_type, title) VALUES ('legacy-custom', 'custom_test', 'Keep me');
SQL
export DATABASE_URL='postgresql://shahoo_test@127.0.0.1:55432/shahoo_upgrade'
npm run db:migrate
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_upgrade -Atc 'SELECT name FROM _migrations ORDER BY name COLLATE "C"' > "$RUN_DIR/upgrade-migrations"
diff -u "$RUN_DIR/expected-migrations" "$RUN_DIR/upgrade-migrations"
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_upgrade <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id='legacy-customer' AND full_name='Synthetic Customer' AND first_name='' AND last_name='') THEN
    RAISE EXCEPTION 'legacy customer not preserved';
  END IF;
  IF (SELECT count(*) FROM customer_addresses WHERE customer_id='legacy-customer') <> 2
     OR (SELECT count(*) FROM customer_addresses WHERE customer_id='legacy-customer' AND is_default AND deleted_at IS NULL) <> 1
     OR NOT EXISTS (SELECT 1 FROM customer_addresses WHERE id='legacy-new' AND is_default AND recipient_name='' AND recipient_mobile='') THEN
    RAISE EXCEPTION 'address data/default migration mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM inventory_logs WHERE id='legacy-log' AND delta=5 AND on_hand_before IS NULL AND on_hand_after IS NULL AND reserved_before IS NULL AND reserved_after IS NULL AND order_id IS NULL) THEN
    RAISE EXCEPTION 'legacy inventory history not preserved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM homepage_sections WHERE id='legacy-custom' AND title='Keep me') THEN
    RAISE EXCEPTION 'custom section not preserved';
  END IF;
  IF to_regclass('public.customer_addresses_one_default_idx') IS NULL OR to_regclass('public.inventory_logs_order_idx') IS NULL THEN
    RAISE EXCEPTION 'expected indexes missing';
  END IF;
END $$;
SELECT 'synthetic upgrade checks passed' AS result;
SQL
npm run db:migrate
```

Expected: the two pending files apply once, prior customer/addresses/custom CMS data survive, exactly the newer legacy default remains active, historical inventory snapshots stay `NULL`, indexes exist, and rerun is up to date. Further realistic source versions, database sizes, custom CMS rows and failure/recovery paths require separately authorized fixtures and recorded runs.

## 4. Foreign keys and transaction behavior — executable DB checks

These checks exercise actual PostgreSQL schema enforcement and SQL transactions, **not** application transaction code. Run on the fresh disposable DB. The nested exception deliberately catches only the expected FK violation; if the insert unexpectedly succeeds, the raised exception fails the command. The committed fixture is removed afterward.

```bash
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_fresh <<'SQL'
DO $$
BEGIN
  BEGIN
    INSERT INTO customer_addresses (id, customer_id, province, city, address_line)
    VALUES ('fk-invalid', 'missing-customer', 'Synthetic', 'Synthetic', 'Synthetic');
    RAISE EXCEPTION 'foreign key unexpectedly allowed an orphan';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;
BEGIN;
INSERT INTO customers (id, full_name) VALUES ('tx-rollback', 'Synthetic');
ROLLBACK;
BEGIN;
INSERT INTO customers (id, full_name) VALUES ('tx-commit', 'Synthetic');
COMMIT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM customers WHERE id='tx-rollback') OR NOT EXISTS (SELECT 1 FROM customers WHERE id='tx-commit') THEN
    RAISE EXCEPTION 'transaction verification failed';
  END IF;
END $$;
DELETE FROM customers WHERE id='tx-commit';
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid IN ('customer_addresses'::regclass, 'inventory_logs'::regclass)
  AND contype='f' ORDER BY conname;
SELECT 'foreign key / transaction checks passed' AS result;
SQL
```

A production-quality test should also force an application operation to fail after intermediate writes and assert rollback of order, inventory, payment, coupon, logs and audit together, using separate real connections; that requires the harness described below. Record failure codes and full sanitized evidence.

## 5. Application and multi-connection scenarios — PARTIALLY VERIFIED

**Verified subset (PR #6, CI run `44729304066`, PR head `4ab448b95a86e8f73f15dc2ed6edc2eaf0663349`):** a Node/Drizzle harness connected to the disposable PostgreSQL 16 CI database and invoked actual application functions with synthetic fixtures. It verified: (1) `commitCheckout` with two independent customer carts competing for two units — exactly one order committed and the other safely rejected; (2) two concurrent `releaseExpiredHolds` workers — exactly one order release, with one expired event and one audit, and no double stock release; (3) two concurrent `captureVerifiedPayment` calls against the same expired order using a local in-memory fake provider — stock was recovered/captured once, with exactly one verified payment, one stock decrement, one paid event and one audit. The same job separately verified actual PostgreSQL row-lock waiting with two independent `pg.Client` connections and a PostgreSQL 16 `pg_dump`/`pg_restore` round trip. The harness uses synthetic fixtures only and performs no network/provider calls.

**Still outstanding:** this is not a full application concurrency harness. The following scenarios remain acceptance specifications, not completed tests. To execute them, extend the isolated harness using `pg.Pool`/Drizzle node-postgres, actual exported application functions, independent connections, explicit barriers/locks, synthetic fixtures, final-row assertions and nonzero failure exits. Use an in-memory fake `PaymentProvider`; make no network/payment/SMS call. Tests of `releaseExpiredHolds`, `captureVerifiedPayment`, `quoteCartWithDb`, `moveOrderStatus`, duplicate callback/settlement, seed initialization and relevant authorization must still use real app code. Record exact CI commit, DB identity, assertions and sanitized results.

| Scenario | Required setup and assertions in that future harness |
|---|---|
| Inventory contention | Two distinct carts/transactions/connections simultaneously order the last single available unit, different keys; coordinate genuine overlap. Exactly one checkout succeeds, the other is rejected/rolled back; `on_hand` and `reserved` remain nonnegative and `reserved <= on_hand`; one order, one reservation movement, no stray order/items/logs for failure. Repeat with reversed scheduling and multiple runs. |
| Same-key checkout | Same buyer/cart submits concurrent duplicate idempotency key: at most one order and reservation; replay behavior returns the existing order without a second reservation. A different buyer/key collision is rejected. Inspect order, cart, inventory and audit records. |
| Reservation expiry | PARTIALLY VERIFIED: two concurrent `releaseExpiredHolds` workers against one expired unpaid checkout order produced exactly one transition to `expired`/`released`, one stock release, one expired event and one audit in run `44729304066`. Still verify coupons, live/paid exclusions, reservation conflicts, backlog beyond the 40-row batch, and the operational invocation/scheduler. |
| Late payment | PARTIALLY VERIFIED: two concurrent `captureVerifiedPayment` calls for the same expired order using a local fake provider resulted in one successful recovery/capture and exactly one verified payment, one stock decrement, one paid event and one audit in run `44729304066`. Still test insufficient stock and every unsellable/deleted/inactive product, variant and category case, full rollback, fresh/upgraded schemas and races with competing checkout. No real gateway was called. |
| Duplicate callbacks | With fake provider, same verified payment key/order/amount/currency repeated sequentially and concurrently should not deduct twice. Sequential replay may return the existing verified result; if two calls pass the initial lookup concurrently, record both responses because the loser may return a conflict rather than the existing result. Different order/amount/currency with reused key is rejected; failed/expired key cannot later become success; race different keys for one order must not double capture. Observe payment rows, status, inventory, payment/order events and audit. This is internal service simulation, not proof of a real gateway callback integration. |
| Cart quote | Invoke `quoteCartWithDb` on real PostgreSQL using valid published product, active category/variant and stock; verify quantity and subtotal from server prices. Independently alter product publication/deletion, category activity/deletion, variant activity/deletion and missing product/variant/inventory and assert unsellable/missing lines omitted and quantity bounded by available stock. Also exercise cart and checkout after state changes. |
| Checkout / late-recovery sellability | The source correction now selects and passes `productVariants.deletedAt` from `checkout.ts` and late `recoverStock` in `payments/service.ts` to `isLineSellable`. Focused single-connection regressions cover stale-cart checkout rejection, reviewed-cart rejection, no-mutation recovery rejection, and preservation of an already-held order's capture policy. Real PostgreSQL concurrency and a live gateway remain unverified; the harness should still exercise this state on the target-equivalent database. |
| Order transitions | Test verified/unpaid flows and RBAC through actual application functions: valid `paid -> processing -> ready_to_ship -> shipped -> delivered` as permitted, unpaid cancellation/stock release, invalid skips or manual `paid` rejected, paid cancellation/refund only through allowed ledger path, refund bounds, and no duplicate stock/coupon effects. Verify persisted events, audit and unauthorized requests. Ledger is not a bank refund. |
| App rollback / seed | Inject an application failure after a write within a transaction, then assert no partial mutation; check baseline and repeated demo initialization, 0010-provisioned and custom homepage section preservation, and duplicate prevention with realistic preexisting records. Test multi-process initialization separately; PGlite results are not proof of a PostgreSQL race. |

Mark only the explicitly tested `commitCheckout` contention and SQL lock rows PASS for the exact CI commit. Mark all remaining scenarios **NOT EXECUTED / BLOCKED**, not PASS. SQL-only experiments are not proof of application behavior.

## 6. Native backup and restore — CI ROUND TRIP VERIFIED; FULL RECOVERY STILL OPEN

PR #6 CI run `44724055534` already executed a synthetic PostgreSQL 16 custom-format `pg_dump` and `pg_restore` round trip. It compared migration count, synthetic probe data and public index count after restore, and both dump/restore scratch DBs were cleaned up. This is evidence for the tested CI schema/data subset, not a full disaster-recovery test. The more comprehensive procedure below remains a future authorized test using the synthetic upgraded DB above, while no test writer is running. Run as an operator with read rights on source and CREATE DATABASE plus restore rights on the isolated test instance. `pg_dump --format=custom` makes a consistent DB snapshot; this sample excludes ownership/ACLs and does not cover globals/roles, external media or external systems. The restore uses `--clean --if-exists`, which can drop objects: the destination must be the newly created disposable `shahoo_restore` database, never a shared or real database. A real recovery plan must separately protect and restore approved role/privilege configuration, media files, secrets, network/TLS and host configuration; validate under least privilege. Do not publish or commit dumps, even if synthetic. For sensitive staging backups require encryption in transit and at rest, restricted retention, verified access and authorization.

```bash
# Keep the file outside the repository in the private directory created above.
pg_dump -w --format=custom --no-owner --no-acl -f "$RUN_DIR/shahoo-upgrade.dump" shahoo_upgrade
# Inspect the archive manifest; it does not itself prove successful recovery.
pg_restore -l "$RUN_DIR/shahoo-upgrade.dump" > "$RUN_DIR/restore-manifest.txt"
createdb -w --template=template0 shahoo_restore
pg_restore -w --exit-on-error --clean --if-exists --no-owner --no-acl -d shahoo_restore "$RUN_DIR/shahoo-upgrade.dump"

for db in shahoo_upgrade shahoo_restore; do
  psql -X -w -v ON_ERROR_STOP=1 -d "$db" -Atc \
    'SELECT name, applied_at FROM _migrations ORDER BY name COLLATE "C"' > "$RUN_DIR/$db.migrations"
  psql -X -w -v ON_ERROR_STOP=1 -d "$db" -Atc \
    "SELECT id, full_name, first_name, last_name FROM customers WHERE id='legacy-customer'" > "$RUN_DIR/$db.customer"
  psql -X -w -v ON_ERROR_STOP=1 -d "$db" -Atc \
    "SELECT id, customer_id, is_default, recipient_name, recipient_mobile FROM customer_addresses WHERE customer_id='legacy-customer' ORDER BY id" > "$RUN_DIR/$db.addresses"
  psql -X -w -v ON_ERROR_STOP=1 -d "$db" -Atc \
    "SELECT id, variant_id, delta, reason, on_hand_before, on_hand_after, reserved_before, reserved_after, order_id FROM inventory_logs WHERE id='legacy-log'" > "$RUN_DIR/$db.inventory-log"
  psql -X -w -v ON_ERROR_STOP=1 -d "$db" -Atc \
    "SELECT c.conrelid::regclass::text, c.conname, c.contype, pg_get_constraintdef(c.oid, true) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY 1,2" > "$RUN_DIR/$db.constraints"
  psql -X -w -v ON_ERROR_STOP=1 -d "$db" -Atc \
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname" > "$RUN_DIR/$db.indexes"
done
for part in migrations customer addresses inventory-log constraints indexes; do
  diff -u "$RUN_DIR/shahoo_upgrade.$part" "$RUN_DIR/shahoo_restore.$part" || exit 1
done
psql -X -w -v ON_ERROR_STOP=1 -d shahoo_restore -c 'SELECT count(*) AS applied_migrations FROM _migrations;'
```

Expected: `pg_restore` exits 0; source/restore comparisons match; count is 11 for this snapshot. Inspect manifest, run the FK/transaction checks against a suitable disposable restore, validate representative catalogue, order and payment records **when fixtures exist**, compare counts and application reads, and document results and restore duration. The supplied upgrade fixture has no orders/payments; an empty match cannot verify those data paths. Repeat on a suitably authorized, consistent staging backup, perform full application-level validation and separately restore associated media. Neither the SQL comparisons nor an archive manifest alone is a complete disaster-recovery test.

## 7. Cleanup and evidence

First save only authorized, sanitized evidence outside the repo, recording test/operator/date, image digest, database/server/client versions, source checksum, commands, outputs, observed failures, and limitations. Do not save password files, connection secrets or real user data. The next commands destroy the entire disposable container and its databases, and delete the private directory and dump. Check the variables before executing; never substitute a production container or path.

```bash
# In the same shell used above, verify these are the intended disposable targets.
printf 'Disposable container: %s\nPrivate directory: %s\n' "$PG_CONTAINER" "$RUN_DIR"
case "$PG_CONTAINER" in shahoo-pg-test-*) ;; *) echo 'Unexpected PG_CONTAINER; stop manually after review' >&2; stop_rc=1 ;; esac
case "$RUN_DIR" in "${TMPDIR:-/tmp}"/shahoo-pg-*) ;; *) echo 'Unexpected RUN_DIR; remove manually after review' >&2; dir_rc=1 ;; esac
stop_rc=${stop_rc:-0}; dir_rc=${dir_rc:-0}
if [ "$stop_rc" -eq 0 ]; then docker stop "$PG_CONTAINER" || stop_rc=$?; fi
if [ "$dir_rc" -eq 0 ]; then rm -rf -- "$RUN_DIR" || dir_rc=$?; fi
unset RUN_DIR PG_CONTAINER DATABASE_URL PGPASSFILE PGHOST PGPORT PGUSER PGDATABASE PGCONNECT_TIMEOUT PGSSLMODE PGTZ
if [ "$stop_rc" -ne 0 ] || [ "$dir_rc" -ne 0 ]; then
  echo "Cleanup incomplete (container=$stop_rc directory=$dir_rc); retain no secrets and review the exact targets manually." >&2
  exit 1
fi
```

Stopping the named `--rm` container discards its tmpfs databases; no `dropdb` against an unspecified server is needed. If setup or an intermediate step failed, explicitly perform the same reviewed cleanup, including any stopped container and private files. Preserve no actual secrets. Reassess the release gate only after the real PostgreSQL app harness, backup/restore, browser/accessibility, private platform and selected-host checks have evidence and the owner approves the next action.


---

## CI execution addendum — isolated SQL contention and backup/restore

The CI PostgreSQL job now includes `scripts/test-postgres-concurrency-backup.mjs` after normal migrations and smoke test. CI run `44729304066` completed successfully for PR head `4ab448b95a86e8f73f15dc2ed6edc2eaf0663349`. The script is restricted to a loopback PostgreSQL host and disposable CI database `shahoo_test`; it refuses a remote hostname or any other database name. The job runs the app-level checkout race before the SQL-only lock probe and backup/restore.

The test clones the freshly migrated CI database into uniquely named scratch databases, opens two independent PostgreSQL clients, and coordinates a row-lock contention test against one synthetic inventory unit. The first transaction reserves the unit; the second waits for the row lock, observes zero remaining units and must not decrement below zero. It then uses PostgreSQL 16 `pg_dump` and `pg_restore` to restore the scratch database into a separate empty database and verifies migration records, the synthetic row, and indexes. Both scratch databases and the temporary dump directory are cleaned up in the CI job.

**Evidence boundary:** this now includes real PostgreSQL multi-connection SQL/locking, actual application `commitCheckout`, concurrent `releaseExpiredHolds`, and concurrent `captureVerifiedPayment` with a local fake provider, plus a native database dump/restore round trip. It does **not** test PayPing/SMS live providers, duplicate callback/settlement races through the callback route, quote/order transitions, multi-process seed initialization, external media/roles/host restoration or a production disaster-recovery procedure. CI's PostgreSQL service and cloned scratch DBs are disposable and contain synthetic fixtures only; no Neon staging or production database is used.


---

## CI execution addendum — application recovery matrix and callback races (2026-11-20)

Latest PR #6 head `17c8e9dd38c7c6a792a39b2b430eb08cf715ab3d` passed GitHub Actions run [44733552547](https://github.com/arefbrh/shahoo/actions/runs/44733552547). The run completed the project suite, PostgreSQL integration/migrations, payment/SMS mocks, quality checks, security checks and migration inventory successfully. The optional private platform harness was skipped because its opt-in repository variable is not enabled.

Additional application-level coverage in this head:

- Late-payment recovery rollback matrix: seven invalid states (unpublished product, soft-deleted product, inactive variant, soft-deleted variant, inactive category, soft-deleted category and insufficient stock). Each case asserts recovery is denied, the order remains expired/unpaid/released, inventory is unchanged, and no payment row, inventory log or audit side effect is written.
- Duplicate concurrent PayPing callback lifecycle race: two callbacks reach provider verification concurrently; assertions require accepted responses, a settled attempt, paid/verified order, exactly one payment row and exactly one verified-payment log.
- Concurrent coupon restoration during expiry: two expiry workers compete on one expired unpaid order; assertions require exactly one release, coupon usage restored to zero once, stock reservation released once and one expiry event/inventory log.

These tests use synthetic fixtures and local/mock provider behavior; they are not live PayPing/SMS.ir tests. PostgreSQL integration and dump/restore continue to run only on disposable GitHub Actions PostgreSQL 16 infrastructure. This evidence does not cover the callback HTTP route end-to-end, checkout competing with late-payment recovery, full migration upgrade/rollback parity, or production-like disaster recovery (roles/globals, external media, secrets, host/network configuration, encryption and retention). No Neon or Production database was accessed.

## Merge record and current evidence boundary — 2026-11-20

PR #6 merged into main by squash commit e190a57b6a7dd68c4e17da67968bbc7bed23bb5d; PR #5 documentation reconciliation merged as 3c481a3e72dcfb6f65e46bc4dc23ef05c3d0024c.

Full enabled CI passed for PR #6 code head d81447976ea758c47dd9be6829f309dbea85b18d in run 44735960032. The post-sync run 44739934934 passed PostgreSQL integration/deep checks, quality, security, payment/SMS mocks and migration inventory; Project tests were still running at merge time. Verify its final result before describing that run as fully green.

The PostgreSQL log for the synchronized head records checkout contention without oversell; concurrent cancellation with one transition, one stock release, one event, one audit and one notification; one-time expiry release and verified payment capture; and PG16 dump/restore preserving 15 migrations plus synthetic schema/index/data probes.

All tests use disposable GitHub Actions PostgreSQL and synthetic data. Provider behavior is mocked/local. This does not prove live PayPing/SMS, Production Neon configuration, browser E2E, callback HTTP route integration, full migration rollback/upgrade parity or production-like disaster recovery.
