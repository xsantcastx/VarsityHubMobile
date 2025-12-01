#!/bin/sh
# Railway startup script: wait for DB, run migrations, then launch API

set -e

RETRIES=${PRISMA_MIGRATE_RETRIES:-20}
SLEEP_SECS=${PRISMA_MIGRATE_SLEEP_SECS:-3}

echo "[startup] Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
	echo "[startup] ERROR: DATABASE_URL is not set"
	exit 1
fi

# Log masked DATABASE_URL and extracted host:port for troubleshooting
MASKED_DB_URL="$(printf "%s" "$DATABASE_URL" | sed -E 's#://([^:/]+):[^@]*@#://\1:***@#')"
DB_HOSTPORT="$(printf "%s" "$DATABASE_URL" | sed -E 's#^[^@]*@([^/]+).*#\1#')"
echo "[startup] DATABASE_URL: $MASKED_DB_URL"
echo "[startup] DB host:port: ${DB_HOSTPORT:-unknown}"

echo "[startup] Applying Prisma migrations (up to $RETRIES retries)..."
count=0
until npx prisma migrate deploy; do
	count=$((count+1))
	if [ $count -ge $RETRIES ]; then
		echo "[startup] ERROR: Failed to apply migrations after $RETRIES attempts"
		exit 1
	fi
	echo "[startup] Prisma migrate failed (attempt $count). Retrying in ${SLEEP_SECS}s..."
	sleep $SLEEP_SECS
done

echo "[startup] Launching API server..."
exec node dist/index.js
