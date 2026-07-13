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

STARTUP_PLACEHOLDER_PID=""

start_startup_placeholder() {
  node <<'EOF' &
const http = require('http');

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
  const isHealthRequest =
    req.url === '/health' || req.url === '/health/' || String(req.url || '').startsWith('/health?');

  res.setHeader('Content-Type', 'application/json');

  if (isHealthRequest) {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 'starting',
        message: 'API startup in progress',
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  res.statusCode = 503;
  res.setHeader('Retry-After', '15');
  res.end(
    JSON.stringify({
      status: 'starting',
      message: 'API startup in progress',
    })
  );
});

server.listen(port, host, () => {
  console.log(`[startup] Placeholder server listening on http://${host}:${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
EOF
  STARTUP_PLACEHOLDER_PID=$!
}

stop_startup_placeholder() {
  if [ -n "${STARTUP_PLACEHOLDER_PID:-}" ] && kill -0 "$STARTUP_PLACEHOLDER_PID" 2>/dev/null; then
    echo "[startup] Stopping placeholder server..."
    kill "$STARTUP_PLACEHOLDER_PID" 2>/dev/null || true
    wait "$STARTUP_PLACEHOLDER_PID" 2>/dev/null || true
  fi
  STARTUP_PLACEHOLDER_PID=""
}

trap 'stop_startup_placeholder' EXIT INT TERM

start_startup_placeholder

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

# The backup Postgres never receives `prisma migrate deploy` — its schema only
# changes here. Without this step, every new migration adding a table/column
# makes the 6-hourly db-backup-sync fail that table with 42P01 until someone
# reconciles by hand (Sentry VARSITYHUB-1D: SportProgram, CoachApplication).
# `db push` (not `migrate deploy`) because the backup has no migration
# history — it diffs the live schema against schema.prisma and converges.
# --accept-data-loss is safe here: the backup is a mirror whose rows are
# rewritten from the primary on every sync. Non-fatal: a backup outage must
# never block API startup; the sync job reports per-table failures instead.
if [ -n "${DATABASE_BACKUP_URL:-}" ]; then
  echo "[startup] Reconciling backup DB schema (prisma db push)..."
  if DATABASE_URL="$DATABASE_BACKUP_URL" timeout 180 ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss; then
    echo "[startup] ✓ Backup DB schema in sync"
  else
    echo "[startup] ⚠️  Backup schema push failed (non-fatal); db-backup-sync will surface per-table failures"
  fi
fi

stop_startup_placeholder
echo "[startup] 🚀 Starting API server..."
exec node dist/index.js
