#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 || ! -f "$1" ]]; then
  echo "Usage: $0 /path/to/verified-backup.dump" >&2
  exit 2
fi
DUMP_FILE="$1"
RESTART_ON_EXIT=0
RESTORE_STARTED=0
cleanup() {
  status=$?
  trap - EXIT
  if [[ "$RESTART_ON_EXIT" == "1" && "$RESTORE_STARTED" == "0" ]]; then
    docker compose start app worker || echo "WARNING: app/worker restart failed; start them manually after checking database state." >&2
  elif [[ "$RESTORE_STARTED" == "1" ]]; then
    echo "Database restore failed after destructive work began; app/worker remain stopped. Verify or restore the database, then start services manually." >&2
  fi
  exit "$status"
}
trap cleanup EXIT

docker compose exec -T db pg_restore --list - < "$DUMP_FILE" >/dev/null
DB_NAME="$(docker compose exec -T db printenv POSTGRES_DB | tr -d '\r')"
DB_ADMIN_USER="$(docker compose exec -T db printenv POSTGRES_USER | tr -d '\r')"
DB_APP_USER="$(docker compose exec -T db printenv APP_DB_USER | tr -d '\r')"

echo "WARNING: this overwrites objects in database '$DB_NAME'."
read -r -p "Type RESTORE to stop app/worker and continue: " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 0
fi

RESTART_ON_EXIT=1
docker compose stop app worker
RESTORE_STARTED=1
docker compose exec -T db dropdb -U "$DB_ADMIN_USER" --if-exists --force "$DB_NAME"
docker compose exec -T db createdb -U "$DB_ADMIN_USER" -O "$DB_APP_USER" "$DB_NAME"
docker compose exec -T db psql -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
docker compose exec -T db psql -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$DB_NAME\" SET timezone TO 'Asia/Tehran';"
docker compose exec -T db psql -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "ALTER ROLE \"$DB_APP_USER\" SET timezone TO 'Asia/Tehran';"
docker compose exec -T db pg_restore --exit-on-error --no-owner -U "$DB_APP_USER" -d "$DB_NAME" < "$DUMP_FILE"
RESTORE_STARTED=0
docker compose start app worker
RESTART_ON_EXIT=0
echo "Database restore command completed. Run the post-restore checks in docs/BACKUP_RESTORE_RUNBOOK.md."
