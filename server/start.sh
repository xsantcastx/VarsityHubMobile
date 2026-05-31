#!/bin/sh
set -e

echo "[startup] Validating environment variables..."
for var in DATABASE_URL NODE_ENV; do
  if [ -z "$(eval echo \\$$var)" ]; then
    echo "[startup] ❌ ERROR: Required env var missing: $var"
    exit 1
  fi
done
echo "[startup] ✓ Required env vars present"

MASKED_DB_URL="$(printf "%s" "$DATABASE_URL" | sed -E 's#://([^:/]+):[^@]*@#://\1:***@#')"
DB_HOSTPORT="$(printf "%s" "$DATABASE_URL" | sed -E 's#^[^@]*@([^/]+).*#\1#')"
echo "[startup] DATABASE_URL: $MASKED_DB_URL"
echo "[startup] DB host:port: ${DB_HOSTPORT:-unknown}"
echo "[startup] NODE_ENV: $NODE_ENV"

echo "[startup] Resolving known stale Prisma history rows..."
./node_modules/.bin/prisma migrate resolve --rolled-back add_severity_to_reports 2>/dev/null || true

PRISMA_MIGRATE_RETRIES="${PRISMA_MIGRATE_RETRIES:-3}"
PRISMA_MIGRATE_SLEEP_SECS="${PRISMA_MIGRATE_SLEEP_SECS:-5}"
PRISMA_MIGRATE_TIMEOUT_SECS="${PRISMA_MIGRATE_TIMEOUT_SECS:-90}"

attempt=1
migrate_ok=0
while [ "$attempt" -le "$PRISMA_MIGRATE_RETRIES" ]; do
  echo "[startup] Running prisma migrate deploy (attempt $attempt/$PRISMA_MIGRATE_RETRIES, timeout ${PRISMA_MIGRATE_TIMEOUT_SECS}s)..."
  if timeout "$PRISMA_MIGRATE_TIMEOUT_SECS" ./node_modules/.bin/prisma migrate deploy; then
    migrate_ok=1
    echo "[startup] ✓ Migrations applied successfully"
    break
  fi

  status=$?
  if [ "$status" -eq 124 ]; then
    echo "[startup] ⚠️  prisma migrate deploy timed out after ${PRISMA_MIGRATE_TIMEOUT_SECS}s"
  else
    echo "[startup] ⚠️  prisma migrate deploy exited with status $status"
  fi

  attempt=$((attempt + 1))
  if [ "$attempt" -le "$PRISMA_MIGRATE_RETRIES" ]; then
    echo "[startup] Retrying in ${PRISMA_MIGRATE_SLEEP_SECS}s..."
    sleep "$PRISMA_MIGRATE_SLEEP_SECS"
  fi
done

if [ "$migrate_ok" -ne 1 ]; then
  echo "[startup] ⚠️  Migration step did not complete successfully; capturing Prisma status and continuing startup."
  ./node_modules/.bin/prisma migrate status || true
fi

echo "[startup] 🚀 Starting API server..."
exec node dist/index.js
