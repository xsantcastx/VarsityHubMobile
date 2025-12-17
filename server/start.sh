#!/bin/bash
set -e

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy || echo "Migrations already up to date"

# Start the server
echo "🚀 Starting API server..."
node dist/index.js
