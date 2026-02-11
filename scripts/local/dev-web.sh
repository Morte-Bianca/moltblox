#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

export NODE_ENV=development
# Web defaults NEXT_PUBLIC_API_URL to http://localhost:3001/api/v1 if not set.
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:3001/api/v1}

echo "[local] Starting Next.js dev server (API: $NEXT_PUBLIC_API_URL)"
pnpm -C apps/web dev
