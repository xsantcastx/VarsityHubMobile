/*
  Warnings:

  - The `status` column on the `Ad` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `payment_status` column on the `Ad` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Event` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `approval_status` column on the `Event` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `approval_status` column on the `Game` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `TeamInvite` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `TeamInvite` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `TeamMembership` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `TeamMembership` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('draft', 'pending', 'active', 'approved', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "AdPaymentStatus" AS ENUM ('unpaid', 'pending_approval', 'hold', 'paid', 'refunded');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('owner', 'manager', 'coach', 'assistant_coach', 'player', 'parent', 'member', 'equipment', 'health_wellness');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'invited', 'archived');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'declined', 'revoked');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "EventApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "GameApprovalStatus" AS ENUM ('approved', 'pending', 'rejected');

-- AlterTable
ALTER TABLE "Ad" DROP COLUMN "status",
ADD COLUMN     "status" "AdStatus" NOT NULL DEFAULT 'draft',
DROP COLUMN "payment_status",
ADD COLUMN     "payment_status" "AdPaymentStatus" NOT NULL DEFAULT 'unpaid',
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "status",
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'draft',
DROP COLUMN "approval_status",
ADD COLUMN     "approval_status" "EventApprovalStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "approval_status",
ADD COLUMN     "approval_status" "GameApprovalStatus" NOT NULL DEFAULT 'approved';

-- AlterTable
ALTER TABLE "TeamInvite" DROP COLUMN "role",
ADD COLUMN     "role" "TeamRole" NOT NULL DEFAULT 'member',
DROP COLUMN "status",
ADD COLUMN     "status" "InviteStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "TeamMembership" DROP COLUMN "role",
ADD COLUMN     "role" "TeamRole" NOT NULL DEFAULT 'member',
DROP COLUMN "status",
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "Ad_status_idx" ON "Ad"("status");

-- CreateIndex
CREATE INDEX "Ad_target_zip_code_payment_status_idx" ON "Ad"("target_zip_code", "payment_status");

-- CreateIndex
CREATE INDEX "Ad_status_payment_status_idx" ON "Ad"("status", "payment_status");

-- CreateIndex
CREATE INDEX "Event_approval_status_idx" ON "Event"("approval_status");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Game_approval_status_idx" ON "Game"("approval_status");
