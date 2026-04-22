-- Add ORG_REJECTED to NotificationType enum.
-- schema.prisma already declared this value but no migration had added it to
-- the Postgres enum, so approvalService.rejectOrganization() was throwing
-- `invalid input value for enum "NotificationType": "ORG_REJECTED"` on any DB
-- that didn't happen to have the value manually patched in. Mirrors the
-- earlier 20260324040000_add_missing_notification_types migration pattern.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORG_REJECTED';
