#!/bin/sh
# Railway startup script: run migrations before launching the API

set -e

echo "[startup] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[startup] Launching API server..."
exec node dist/index.js
