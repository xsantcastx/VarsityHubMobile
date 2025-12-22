#!/usr/bin/env sh
set -e

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy || echo "Migrations already up to date"

# Start the server
echo "🚀 Starting API server..."
exec node dist/index.js
