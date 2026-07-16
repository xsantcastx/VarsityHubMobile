-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ORG_OWNERSHIP_TRANSFER_OFFER';
ALTER TYPE "NotificationType" ADD VALUE 'ORG_OWNERSHIP_TRANSFER_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'ORG_OWNERSHIP_TRANSFER_DECLINED';

-- CreateTable
CREATE TABLE "OrganizationOwnershipTransfer" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "OrganizationOwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationOwnershipTransfer_organization_id_status_idx" ON "OrganizationOwnershipTransfer"("organization_id", "status");

-- CreateIndex
CREATE INDEX "OrganizationOwnershipTransfer_to_user_id_status_idx" ON "OrganizationOwnershipTransfer"("to_user_id", "status");

-- AddForeignKey
ALTER TABLE "OrganizationOwnershipTransfer" ADD CONSTRAINT "OrganizationOwnershipTransfer_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationOwnershipTransfer" ADD CONSTRAINT "OrganizationOwnershipTransfer_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationOwnershipTransfer" ADD CONSTRAINT "OrganizationOwnershipTransfer_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

