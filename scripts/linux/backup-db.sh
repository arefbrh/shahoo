#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${1:-/opt/shahoo/backups/database}"
RETENTION_DAYS="${2:-30}"
case "$RETENTION_DAYS" in
  ''|*[!0-9]*) echo "RETENTION_DAYS must be a positive integer" >&2; exit 2 ;;
esac
if [[ "$RETENTION_DAYS" -lt 1 ]]; then
  echo "RETENTION_DAYS must be at least 1" >&2
  exit 2
fi
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
FINAL="$BACKUP_DIR/shahoo_db_$STAMP.dump"
TEMP="$FINAL.tmp"
trap 'rm -f "$TEMP"' EXIT

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 6' > "$TEMP"
if [[ ! -s "$TEMP" ]]; then
  echo "Backup file is empty." >&2
  exit 1
fi
docker compose exec -T db pg_restore --list - < "$TEMP" >/dev/null
mv "$TEMP" "$FINAL"
find "$BACKUP_DIR" -type f -name 'shahoo_db_*.dump' -mtime "+$RETENTION_DAYS" -delete
echo "Database backup verified: $FINAL"
