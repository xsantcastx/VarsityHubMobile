-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'JOIN_REQUEST_DENIED';

-- AlterTable
ALTER TABLE "OrganizationJoinRequest" ADD COLUMN     "rejection_reason" TEXT;
