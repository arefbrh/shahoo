#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"
if [[ -f .env ]]; then
  set -a
  . ./.env
  set +a
fi

ISSUES=()
check_health() {
  local container="$1"
  local expected="$2"
  local actual
  if ! actual="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null)"; then
    actual="missing"
  fi
  if [[ "$actual" != "$expected" ]]; then
    ISSUES+=("$container health=$actual (expected $expected)")
  fi
}

check_health shahoo_db healthy
check_health shahoo_app healthy
check_health shahoo_worker healthy
check_health shahoo_proxy running

if ! docker compose exec -T app curl -fsS 'http://127.0.0.1:3000/api/health?type=ready' >/dev/null; then
  ISSUES+=("application readiness endpoint failed")
fi

DISK_FREE="$(df -P "$PROJECT_ROOT" | awk 'NR==2 {gsub(/%/,"",$5); print 100-$5}')"
if [[ -z "$DISK_FREE" || "$DISK_FREE" -lt 15 ]]; then
  ISSUES+=("disk free below 15% (${DISK_FREE:-unknown})")
fi


DB_BACKUP_DIR="${DB_BACKUP_DIR:-/opt/shahoo/backups/database}"
MEDIA_BACKUP_DIR="${MEDIA_BACKUP_DIR:-/opt/shahoo/backups/media}"
if ! find "$DB_BACKUP_DIR" -maxdepth 1 -type f -name 'shahoo_db_*.dump' -mmin -1560 -print -quit 2>/dev/null | grep -q .; then
  ISSUES+=("no verified database backup newer than 26 hours")
fi
if ! find "$MEDIA_BACKUP_DIR" -maxdepth 1 -type f -name 'shahoo_media_*.tar.gz' -mmin -1560 -print -quit 2>/dev/null | grep -q .; then
  ISSUES+=("no media backup newer than 26 hours")
fi

if ((${#ISSUES[@]})); then
  printf 'SHAHOO health issues:\n'
  printf ' - %s\n' "${ISSUES[@]}"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    MESSAGE="SHAHOO health alert: $(printf '%s; ' "${ISSUES[@]}")"
    curl -fsS --max-time 10 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=${MESSAGE}" >/dev/null
  fi
  exit 1
fi

echo "SHAHOO app, database, worker, proxy and disk checks passed."
