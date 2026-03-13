-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: Add approval_status to User (default APPROVED so existing users are unaffected)
ALTER TABLE "User" ADD COLUMN "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable: Add paid_by_owner to User (coaches covered by league owner)
ALTER TABLE "User" ADD COLUMN "paid_by_owner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add super admin approval fields and league owner to Organization
ALTER TABLE "Organization" ADD COLUMN "admin_approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "approved_by" TEXT;
ALTER TABLE "Organization" ADD COLUMN "approved_at" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "league_owner_id" TEXT;

-- AlterTable: Add team_id to Event for fan pitch events
ALTER TABLE "Event" ADD COLUMN "team_id" TEXT;

-- AddForeignKey: Organization.league_owner_id -> User.id
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_league_owner_id_fkey" FOREIGN KEY ("league_owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Event.team_id -> Team.id
ALTER TABLE "Event" ADD CONSTRAINT "Event_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Organization_league_owner_id_idx" ON "Organization"("league_owner_id");
CREATE INDEX "Event_team_id_idx" ON "Event"("team_id");
