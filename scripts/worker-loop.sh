#!/bin/sh
set -eu

interval="${WORKER_INTERVAL_SECONDS:-300}"
case "$interval" in
  ''|*[!0-9]*) echo "WORKER_INTERVAL_SECONDS must be an integer" >&2; exit 2 ;;
esac
if [ "$interval" -lt 30 ]; then
  echo "WORKER_INTERVAL_SECONDS must be at least 30" >&2
  exit 2
fi

task_timeout="${WORKER_TASK_TIMEOUT_SECONDS:-240}"
case "$task_timeout" in
  ''|*[!0-9]*) echo "WORKER_TASK_TIMEOUT_SECONDS must be an integer" >&2; exit 2 ;;
esac
if [ "$task_timeout" -lt 1 ]; then
  echo "WORKER_TASK_TIMEOUT_SECONDS must be at least 1" >&2
  exit 2
fi

heartbeat="${WORKER_HEARTBEAT_FILE:-/tmp/shahoo-worker-heartbeat}"
write_heartbeat() {
  date +%s > "${heartbeat}.tmp"
  mv "${heartbeat}.tmp" "$heartbeat"
}
write_heartbeat
while :; do
  timeout "$task_timeout" node --experimental-transform-types --import ./scripts/ts-alias-register.mjs scripts/release-expired-holds.mjs
  write_heartbeat
  sleep "$interval"
done
