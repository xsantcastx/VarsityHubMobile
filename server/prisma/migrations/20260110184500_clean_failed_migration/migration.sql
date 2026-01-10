-- This migration cleans up the stuck failed migration record
-- It allows Prisma to continue with migrations

-- Remove the failed migration entry from the migrations table
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260110183000_add_severity_to_reports';

-- This migration does nothing else - it just cleans up the failed state
