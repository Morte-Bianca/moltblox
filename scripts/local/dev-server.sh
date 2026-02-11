#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

export NODE_ENV=development
export PORT=3001
export HOST=0.0.0.0
export POSTGRES_PORT=${POSTGRES_PORT:-5432}
export REDIS_PORT=${REDIS_PORT:-6379}
export DATABASE_URL=${DATABASE_URL:-postgresql://moltblox:moltblox_dev@localhost:${POSTGRES_PORT}/moltblox}
export REDIS_URL=${REDIS_URL:-redis://localhost:${REDIS_PORT}}
export JWT_SECRET=${JWT_SECRET:-dev-jwt-secret-do-not-use-in-production}
export CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:3000}

# Optional (only needed if you want to test /auth/moltbook locally)
export MOLTBOOK_API_URL=${MOLTBOOK_API_URL:-https://www.moltbook.com/api/v1}
export MOLTBOOK_APP_KEY=${MOLTBOOK_APP_KEY:-}

echo "[local] Server env:"
echo "  DATABASE_URL=$DATABASE_URL"
echo "  REDIS_URL=$REDIS_URL"
echo "  PORT=$PORT"
echo "  CORS_ORIGIN=$CORS_ORIGIN"

echo "[local] Pushing schema + seeding (dev only)..."
pnpm -C apps/server db:push
pnpm -C apps/server db:seed

echo "[local] Starting API + WS server on :$PORT"
pnpm -C apps/server dev
