#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${ROOT_DIR}/server"

export PORT="${PORT:-4100}"
export HOST="${HOST:-127.0.0.1}"
export NODE_ENV="${NODE_ENV:-development}"
export DATABASE_URL="${DATABASE_URL:-${TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/varsityhub_test?schema=public}}"
export JWT_SECRET="${JWT_SECRET:-test-jwt-secret-test-jwt-secret-1234}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-test-refresh-secret-test-refresh-secret-1234}"

cd "${SERVER_DIR}"
npx prisma db push --skip-generate >/dev/null
exec npx tsx src/index.ts
