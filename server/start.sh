#!/bin/sh
# Railway Startup Script
# This runs migrations before starting the server

set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete! Starting server..."
exec node dist/index.js
