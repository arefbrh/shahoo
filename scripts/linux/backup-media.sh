#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${STORAGE_PROVIDER:-local}" == "s3" ]]; then
  echo "Local media backup is disabled for STORAGE_PROVIDER=s3; back up the active object-storage bucket instead." >&2
  exit 2
fi
BACKUP_DIR="${1:-/opt/shahoo/backups/media}"
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
FINAL="$BACKUP_DIR/shahoo_media_$STAMP.tar.gz"
TEMP="$FINAL.tmp"
trap 'rm -f "$TEMP"' EXIT

docker compose exec -T app tar -czf - -C /app/storage media > "$TEMP"
tar -tzf "$TEMP" >/dev/null
mv "$TEMP" "$FINAL"
find "$BACKUP_DIR" -type f -name 'shahoo_media_*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
echo "Media archive verified: $FINAL"
