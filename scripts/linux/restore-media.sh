#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 || ! -f "$1" ]]; then
  echo "Usage: $0 /path/to/media-backup.tar.gz" >&2
  exit 2
fi
ARCHIVE="$1"
if [[ "${STORAGE_PROVIDER:-local}" == "s3" ]]; then
  echo "Local media restore is disabled for STORAGE_PROVIDER=s3; restore the active object-storage bucket instead." >&2
  exit 2
fi
tar -tzf "$ARCHIVE" >/dev/null
# GNU tar listing mode: only regular files and directories are accepted.
# Reject symlinks, hardlinks, special files and device nodes before any service stop.
while IFS= read -r metadata; do
  case "${metadata:0:1}" in
    -|d) ;;
    *) echo "Unsafe archive entry type rejected: $metadata" >&2; exit 2 ;;
  esac
done < <(tar -tvzf "$ARCHIVE")
while IFS= read -r entry; do
  case "$entry" in
    /*|..|../*|*/../*|*/..)
      echo "Unsafe archive path rejected: $entry" >&2
      exit 2
      ;;
    media|media/*)
      ;;
    *)
      echo "Unexpected archive root rejected: $entry" >&2
      exit 2
      ;;
  esac
done < <(tar -tzf "$ARCHIVE")
echo "WARNING: files under /app/storage/media will be overwritten where paths match."
read -r -p "Type RESTORE to stop app/worker and continue: " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Restore cancelled."
  exit 0
fi

RESTART_ON_EXIT=0
RESTORE_STARTED=0
cleanup() {
  status=$?
  trap - EXIT
  if [[ "$RESTART_ON_EXIT" == "1" && "$RESTORE_STARTED" == "0" ]]; then
    docker compose start app worker || echo "WARNING: app/worker restart failed; start them manually after checking media." >&2
  elif [[ "$RESTORE_STARTED" == "1" ]]; then
    echo "Media restore failed after replacing the directory; app/worker remain stopped. Inspect the preserved pre-restore directory, then recover manually." >&2
  fi
  exit "$status"
}
trap cleanup EXIT
RESTART_ON_EXIT=1
docker compose stop app worker
RESTORE_STARTED=1
# app is stopped, so `docker compose exec app` would fail. Use a temporary,
# non-service app container with the same media volume instead. Never rename
# the volume mountpoint itself (which fails with "device busy").
docker compose run --rm --no-deps -T --entrypoint sh app -c '
  set -eu
  cd /app/storage/media
  stamp="$(date +%s)-$$"
  stage=".restore-staging-$stamp"
  previous=".pre-restore-$stamp"
  mkdir "$stage" "$previous"
  tar -xzf - -C "$stage"
  test -d "$stage/media" || { echo "Archive missing media root" >&2; exit 2; }
  # Preserve the previous media tree within the same volume for recovery.
  for item in ./* ./.[!.]* ./..?*; do
    [ -e "$item" ] || [ -L "$item" ] || continue
    case "$item" in "./$stage"|"./$previous") continue ;; esac
    mv "$item" "$previous/"
  done
  for item in "$stage"/media/* "$stage"/media/.[!.]* "$stage"/media/..?*; do
    [ -e "$item" ] || [ -L "$item" ] || continue
    mv "$item" ./
  done
  rmdir "$stage/media" "$stage"
  echo "Previous local media retained in $previous"
' < "$ARCHIVE"
RESTORE_STARTED=0
docker compose start app worker
RESTART_ON_EXIT=0
echo "Media restore command completed. Run the post-restore checks in docs/BACKUP_RESTORE_RUNBOOK.md."
