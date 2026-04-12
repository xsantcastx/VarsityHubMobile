/*
  Warnings:

  - You are about to drop the column `expires_at` on the `AdReservation` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `AdReservation` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_session_id` on the `AdReservation` table. All the data in the column will be lost.
  - You are about to drop the column `banner_image_url` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `group` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `round` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `stadium` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `stadium_capacity` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `stadium_name` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `tournament_organization_id` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `formatted_address` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `is_tournament` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `logo_url` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `opened_year` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `place_id` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `stadium_name` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `tournament_end_date` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `tournament_format` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `tournament_location` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `tournament_logo_url` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `tournament_rules` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `tournament_start_date` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `phone_number` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phone_verification_code` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phone_verification_expires` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phone_verified` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE';

-- DropForeignKey
ALTER TABLE "AdReservation" DROP CONSTRAINT "AdReservation_ad_id_fkey";

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_tournament_organization_id_fkey";

-- DropIndex
DROP INDEX "AdReservation_status_expires_at_idx";

-- DropIndex
DROP INDEX "AdReservation_stripe_session_id_idx";

-- DropIndex
DROP INDEX "Game_tournament_organization_id_idx";

-- DropIndex
DROP INDEX "Organization_place_id_key";

-- DropIndex
DROP INDEX "Organization_type_idx";

-- AlterTable
ALTER TABLE "AdReservation" DROP COLUMN "expires_at",
DROP COLUMN "status",
DROP COLUMN "stripe_session_id";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "banner_image_url",
DROP COLUMN "group",
DROP COLUMN "round",
DROP COLUMN "stadium",
DROP COLUMN "stadium_capacity",
DROP COLUMN "stadium_name",
DROP COLUMN "tournament_organization_id";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "message_id" TEXT;

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "capacity",
DROP COLUMN "created_by",
DROP COLUMN "formatted_address",
DROP COLUMN "is_tournament",
DROP COLUMN "latitude",
DROP COLUMN "logo_url",
DROP COLUMN "longitude",
DROP COLUMN "opened_year",
DROP COLUMN "place_id",
DROP COLUMN "stadium_name",
DROP COLUMN "tournament_end_date",
DROP COLUMN "tournament_format",
DROP COLUMN "tournament_location",
DROP COLUMN "tournament_logo_url",
DROP COLUMN "tournament_rules",
DROP COLUMN "tournament_start_date",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "phone_number",
DROP COLUMN "phone_verification_code",
DROP COLUMN "phone_verification_expires",
DROP COLUMN "phone_verified",
ADD COLUMN     "password_changed_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Ad_target_zip_code_payment_status_idx" ON "Ad"("target_zip_code", "payment_status");

-- CreateIndex
CREATE INDEX "EventRsvp_user_id_idx" ON "EventRsvp"("user_id");

-- CreateIndex
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "Post_game_id_type_idx" ON "Post"("game_id", "type");

-- CreateIndex
CREATE INDEX "PostBookmark_user_id_idx" ON "PostBookmark"("user_id");

-- CreateIndex
CREATE INDEX "PostUpvote_user_id_idx" ON "PostUpvote"("user_id");

-- CreateIndex
CREATE INDEX "Story_expires_at_idx" ON "Story"("expires_at");

-- CreateIndex
CREATE INDEX "TeamMembership_user_id_idx" ON "TeamMembership"("user_id");

-- AddForeignKey
ALTER TABLE "AdReservation" ADD CONSTRAINT "AdReservation_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
