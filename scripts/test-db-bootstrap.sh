#!/usr/bin/env bash
# Disposable real-Postgres verification of Docker entrypoint role separation.
set -Eeuo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the bootstrap integration test" >&2
  exit 2
fi

name="shahoo-bootstrap-test-$$"
admin_password="local-test-admin-$RANDOM"
app_password="local-test-app-$RANDOM"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" \
  -e POSTGRES_DB=shahoo_bootstrap_test \
  -e POSTGRES_USER=shahoo_admin \
  -e POSTGRES_PASSWORD="$admin_password" \
  -e APP_DB_USER=shahoo_app \
  -e APP_DB_PASSWORD="$app_password" \
  -v "$(pwd)/scripts/init-db.sql:/docker-entrypoint-initdb.d/10-shahoo-init.sql:ro" \
  postgres:16-alpine >/dev/null

ready=0
for attempt in $(seq 1 60); do
  if docker exec "$name" pg_isready -U shahoo_admin -d shahoo_bootstrap_test >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  docker logs "$name" >&2
  echo "Disposable PostgreSQL did not become ready" >&2
  exit 1
fi

# Force a TCP connection so the app password is actually exercised.
app_sql() {
  docker exec -e PGPASSWORD="$app_password" "$name" \
    psql -h 127.0.0.1 -v ON_ERROR_STOP=1 -At -U shahoo_app -d shahoo_bootstrap_test "$@"
}

privileges="$(app_sql -c "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = current_user;")"
[[ "$privileges" == 'f|f|f|f|f' ]] || { echo "App role has unsafe privileges: $privileges" >&2; exit 1; }

owner="$(app_sql -c "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database();")"
[[ "$owner" == 'shahoo_app' ]] || { echo "Wrong database owner: $owner" >&2; exit 1; }
schema_owner="$(app_sql -c "SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public';")"
[[ "$schema_owner" == 'shahoo_app' ]] || { echo "Wrong public schema owner: $schema_owner" >&2; exit 1; }
if app_sql -c 'CREATE ROLE shahoo_forbidden_role;' >/dev/null 2>&1; then
  echo "App role unexpectedly allowed CREATE ROLE" >&2
  exit 1
fi

echo "PASS: app login, least-privilege role, database and schema ownership, denied CREATE ROLE"
