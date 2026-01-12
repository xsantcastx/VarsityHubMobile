#!/bin/bash
set -e

# Run database migrations
echo "🗄️  Running database migrations..."

# First, try to resolve any failed migrations
echo "Checking for failed migrations..."
npx prisma migrate resolve --rolled-back 20260110183000_add_severity_to_reports || true

# Now deploy migrations
npx prisma migrate deploy || echo "Migrations already up to date"

# Start the server
echo "🚀 Starting API server..."
node dist/index.js
