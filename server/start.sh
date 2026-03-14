#!/bin/bash
set -e

# Run database migrations
echo "🗄️  Running database migrations..."
./node_modules/.bin/prisma migrate deploy

# Start the server
echo "🚀 Starting API server..."
node dist/index.js
