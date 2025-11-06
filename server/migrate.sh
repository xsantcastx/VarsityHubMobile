#!/bin/sh
# Railway Migration Script
# Run this in Railway dashboard: Service → Settings → Deploy → One-off Command

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete!"
echo ""
echo "📊 Checking migration status..."
npx prisma migrate status

echo ""
echo "🎯 Database is ready!"
