-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email_verification_code" TEXT,
ADD COLUMN     "email_verification_expires" TIMESTAMP(3),
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false;
