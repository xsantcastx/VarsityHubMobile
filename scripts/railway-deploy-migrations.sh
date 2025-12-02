#!/bin/bash
# Deploy Prisma migrations on Railway
# Run this as a one-off command in Railway Dashboard or via railway shell

set -e

echo "🔄 Deploying Prisma migrations to Railway..."
cd server

echo "📋 Running prisma migrate deploy..."
npx prisma migrate deploy

echo "🔨 Regenerating Prisma client..."
npx prisma generate

echo "✅ Migrations deployed successfully!"
echo ""
echo "🔍 Checking migration status..."
npx prisma migrate status
