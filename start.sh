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

echo "[startup] Applying Prisma migrations (up to $RETRIES retries with exponential backoff)..."
count=0
current_sleep=$SLEEP_SECS
until npx prisma migrate deploy; do
	count=$((count+1))
	if [ $count -ge $RETRIES ]; then
		echo "[startup] ❌ ERROR: Failed to apply migrations after $RETRIES attempts"
		echo "[startup] Database may be unavailable or migrations have syntax errors"
		echo "[startup] Check: 1) DATABASE_URL is correct, 2) DB is running, 3) migrations are valid"
		exit 1
	fi
	echo "[startup] ⚠️  Prisma migrate failed (attempt $count/$RETRIES). Retrying in ${current_sleep}s..."
	sleep $current_sleep
	# Exponential backoff (capped at MAX_SLEEP_SECS)
	current_sleep=$((current_sleep * 2))
	if [ $current_sleep -gt $MAX_SLEEP_SECS ]; then
		current_sleep=$MAX_SLEEP_SECS
	fi
done

echo "[startup] ✓ Migrations applied successfully"
echo "[startup] Launching API server on port 4000..."
exec node dist/index.js
