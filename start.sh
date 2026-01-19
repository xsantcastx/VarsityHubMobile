#!/bin/sh
# Railway startup script: wait for DB, run migrations, then launch API

set -e

# Validate required environment variables
echo "[startup] Validating environment variables..."
for var in DATABASE_URL NODE_ENV; do
  if [ -z "$(eval echo \\$$var)" ]; then
    echo "[startup] ❌ ERROR: Required env var missing: $var"
    exit 1
  fi
done

echo "[startup] ✓ All required env vars present"

# Optional but recommended for production
if [ -z "$SENTRY_DSN" ]; then
  echo "[startup] ⚠️  Warning: SENTRY_DSN not set - error tracking disabled"
fi

RETRIES=${PRISMA_MIGRATE_RETRIES:-25}
SLEEP_SECS=${PRISMA_MIGRATE_SLEEP_SECS:-2}
MAX_SLEEP_SECS=10

echo "[startup] Checking DATABASE_URL..."
# Log masked DATABASE_URL and extracted host:port for troubleshooting
MASKED_DB_URL="$(printf "%s" "$DATABASE_URL" | sed -E 's#://([^:/]+):[^@]*@#://\1:***@#')"
DB_HOSTPORT="$(printf "%s" "$DATABASE_URL" | sed -E 's#^[^@]*@([^/]+).*#\1#')"
echo "[startup] DATABASE_URL: $MASKED_DB_URL"
echo "[startup] DB host:port: ${DB_HOSTPORT:-unknown}"
echo "[startup] Build timestamp: $(date)"
echo "[startup] NODE_ENV: $NODE_ENV"

echo "[startup] Checking/applying Prisma migrations..."

# Resolve all known problematic migrations
echo "[startup] Resolving known migrations..."
npx prisma migrate resolve --applied 20251129064754_add_reservation_status 2>/dev/null || true
npx prisma migrate resolve --applied 20250922180000_add_custom_position_to_team_memberships 2>/dev/null || true

# Try to deploy migrations, but don't fail if there are issues
# (migrations are managed manually for production)
echo "[startup] Running migrate deploy..."
if npx prisma migrate deploy 2>&1; then
	echo "[startup] ✓ Migrations applied successfully"
else
	echo "[startup] ⚠️  Migration deploy had issues, checking status..."
	npx prisma migrate status 2>&1 || true
	echo "[startup] Proceeding with server startup (migrations may already be applied)..."
fi

echo "[startup] ✓ Migration check complete"
echo "[startup] Launching API server on port 4000..."
exec node dist/index.js
