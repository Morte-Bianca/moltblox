#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

if lsof -iTCP:5432 -sTCP:LISTEN >/dev/null 2>&1; then
	export POSTGRES_PORT=${POSTGRES_PORT:-5433}
else
	export POSTGRES_PORT=${POSTGRES_PORT:-5432}
fi

if lsof -iTCP:6379 -sTCP:LISTEN >/dev/null 2>&1; then
	export REDIS_PORT=${REDIS_PORT:-6380}
else
	export REDIS_PORT=${REDIS_PORT:-6379}
fi

echo "[local] Starting Postgres + Redis via docker compose..."
echo "[local] Using ports: POSTGRES_PORT=$POSTGRES_PORT REDIS_PORT=$REDIS_PORT"
docker compose up -d postgres redis

echo "[local] Infra is starting. You can check with: docker compose ps"
