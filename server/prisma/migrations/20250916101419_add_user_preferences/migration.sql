/*
  Warnings:

  - You are about to drop the column `author` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `created_date` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `recipient_email` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `sender_email` on the `Message` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ad_id,date]` on the table `AdReservation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[team_id,email]` on the table `TeamInvite` will be added. If there are existing duplicate values, this will fail.
  - Made the column `radius` on table `Ad` required. This step will fail if there are existing NULL values in that column.
  - Made the column `title` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Made the column `date` on table `Event` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `recipient_id` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sender_id` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Made the column `author_id` on table `Post` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_post_id_fkey";

-- DropForeignKey
ALTER TABLE "EventRsvp" DROP CONSTRAINT "EventRsvp_event_id_fkey";

-- DropForeignKey
ALTER TABLE "EventRsvp" DROP CONSTRAINT "EventRsvp_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Follows" DROP CONSTRAINT "Follows_follower_id_fkey";

-- DropForeignKey
ALTER TABLE "Follows" DROP CONSTRAINT "Follows_following_id_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_author_id_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_game_id_fkey";

-- DropForeignKey
ALTER TABLE "TeamInvite" DROP CONSTRAINT "TeamInvite_team_id_fkey";

-- DropForeignKey
ALTER TABLE "TeamMembership" DROP CONSTRAINT "TeamMembership_team_id_fkey";

-- DropForeignKey
ALTER TABLE "TeamMembership" DROP CONSTRAINT "TeamMembership_user_id_fkey";

-- DropIndex
DROP INDEX "AdReservation_date_key";

-- DropIndex
DROP INDEX "Message_created_date_idx";

-- AlterTable
ALTER TABLE "Ad" ALTER COLUMN "radius" SET NOT NULL;

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "author",
ADD COLUMN     "author_id" TEXT;

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "date" SET NOT NULL;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "created_date",
DROP COLUMN "read",
DROP COLUMN "recipient_email",
DROP COLUMN "sender_email",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "recipient_id" TEXT NOT NULL,
ADD COLUMN     "sender_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "author_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "AdReservation_ad_id_date_key" ON "AdReservation"("ad_id", "date");

-- CreateIndex
CREATE INDEX "Comment_author_id_created_at_idx" ON "Comment"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "Follows_follower_id_idx" ON "Follows"("follower_id");

-- CreateIndex
CREATE INDEX "Follows_following_id_idx" ON "Follows"("following_id");

-- CreateIndex
CREATE INDEX "Message_created_at_idx" ON "Message"("created_at");

-- CreateIndex
CREATE INDEX "Message_sender_id_created_at_idx" ON "Message"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "Message_recipient_id_created_at_idx" ON "Message"("recipient_id", "created_at");

-- CreateIndex
CREATE INDEX "Post_game_id_created_at_idx" ON "Post"("game_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_team_id_email_key" ON "TeamInvite"("team_id", "email");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follows" ADD CONSTRAINT "Follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follows" ADD CONSTRAINT "Follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
