#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  echo "Created .env from the template. Configure DATABASE_URL and secrets, then run again." >&2
  exit 2
fi

set -a
# .env must be an operator-maintained shell-compatible file.
. ./.env
set +a

if [[ -z "${DATABASE_URL:-}" || "$DATABASE_URL" == *replace_with_* ]]; then
  echo "DATABASE_URL is required for a native self-hosted deployment." >&2
  exit 2
fi

export NODE_ENV=production
export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"
export TZ=Asia/Tehran

if [[ ! -f .output/server/index.mjs ]]; then
  npm run build:self-hosted
fi

exec node .output/server/index.mjs
