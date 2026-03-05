-- AlterTable
ALTER TABLE "User" ADD COLUMN "refresh_token" TEXT,
ADD COLUMN "refresh_token_expires" TIMESTAMP(3);
