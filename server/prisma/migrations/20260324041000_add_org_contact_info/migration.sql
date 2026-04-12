-- Add missing contact_info column to Organization table
-- This was in the Prisma schema but never migrated
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "contact_info" TEXT;
