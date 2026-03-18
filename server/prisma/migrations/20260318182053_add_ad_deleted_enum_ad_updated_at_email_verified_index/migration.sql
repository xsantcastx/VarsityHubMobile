/*
  Warnings:

  - Added the required column `updated_at` to the `Ad` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'AD_DELETED';

-- AlterTable
ALTER TABLE "Ad" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "User_refresh_token_idx" ON "User"("refresh_token");

-- CreateIndex
CREATE INDEX "User_email_verified_idx" ON "User"("email_verified");
