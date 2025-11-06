/*
  Warnings:

  - You are about to drop the column `away_team` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `home_team` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "approval_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "contact_info" TEXT,
ADD COLUMN     "creator_id" TEXT,
ADD COLUMN     "creator_role" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "event_type" TEXT,
ADD COLUMN     "linked_league" TEXT,
ADD COLUMN     "max_attendees" INTEGER,
ADD COLUMN     "rejected_reason" TEXT;

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "away_team",
DROP COLUMN "home_team",
ADD COLUMN     "away_team_id" TEXT,
ADD COLUMN     "away_team_name" TEXT,
ADD COLUMN     "home_team_id" TEXT,
ADD COLUMN     "is_neutral" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "venue_address" TEXT,
ADD COLUMN     "venue_lat" DOUBLE PRECISION,
ADD COLUMN     "venue_lng" DOUBLE PRECISION,
ADD COLUMN     "venue_place_id" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "city" TEXT,
ADD COLUMN     "league" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "venue_address" TEXT,
ADD COLUMN     "venue_lat" DOUBLE PRECISION,
ADD COLUMN     "venue_lng" DOUBLE PRECISION,
ADD COLUMN     "venue_place_id" TEXT,
ADD COLUMN     "venue_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "max_teams" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "subscription_expires_at" TIMESTAMP(3),
ADD COLUMN     "subscription_status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "subscription_tier" TEXT NOT NULL DEFAULT 'free';

-- CreateIndex
CREATE INDEX "Event_creator_id_idx" ON "Event"("creator_id");

-- CreateIndex
CREATE INDEX "Event_approval_status_idx" ON "Event"("approval_status");

-- CreateIndex
CREATE INDEX "Event_event_type_idx" ON "Event"("event_type");

-- CreateIndex
CREATE INDEX "Game_home_team_id_idx" ON "Game"("home_team_id");

-- CreateIndex
CREATE INDEX "Game_away_team_id_idx" ON "Game"("away_team_id");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_city_state_idx" ON "Team"("city", "state");

-- CreateIndex
CREATE INDEX "Team_sport_idx" ON "Team"("sport");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
