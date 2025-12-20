#!/usr/bin/env zsh

# Verification script to ensure EventPostAccess is safe to drop
# Searches all source files for references to the deprecated table

echo "🔍 Scanning for EventPostAccess references...\n"

echo "TypeScript Files:"
echo "================"
grep -r "EventPostAccess" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  server/src/ app/ 2>/dev/null | grep -v node_modules || echo "  ✅ No references found"

echo "\n\nPrisma Schema:"
echo "=============="
grep -r "EventPostAccess" \
  --include="*.prisma" \
  server/prisma/ 2>/dev/null || echo "  ✅ No references found"

echo "\n\nDatabase Migrations:"
echo "==================="
grep -r "EventPostAccess" \
  --include="*.sql" \
  server/prisma/migrations/ 2>/dev/null | grep -v "drop-event-post-access.sql" || echo "  ✅ No references found in other migrations"

echo "\n\nGraphQL Schema (if applicable):"
echo "=============================="
find . -name "*.graphql" -o -name "schema.graphql" 2>/dev/null | \
  xargs grep -l "EventPostAccess" 2>/dev/null || echo "  ✅ No references found"

echo "\n\n📋 Summary of migration file: server/prisma/migrations/drop-event-post-access.sql"
wc -l server/prisma/migrations/drop-event-post-access.sql 2>/dev/null || echo "Migration file not found"

echo "\n\n✅ Verification complete. Check above for any remaining references."
echo "   If no references found, migration is safe to apply."
