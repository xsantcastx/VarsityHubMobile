-- Opponent-approval workflow: when a coach links a VarsityHub team as
-- opponent that they do NOT manage, the game only becomes publicly visible
-- once that opponent team's staff confirms it. Fully additive — every
-- existing Game row gets opponent_approval_status = 'not_required' via the
-- column default, so no existing game is affected.

-- CreateEnum
CREATE TYPE "OpponentApprovalStatus" AS ENUM ('not_required', 'pending', 'approved', 'declined');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "NotificationType" ADD VALUE 'GAME_OPPONENT_APPROVAL_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'GAME_OPPONENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'GAME_OPPONENT_DECLINED';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "opponent_approval_status" "OpponentApprovalStatus" NOT NULL DEFAULT 'not_required',
ADD COLUMN     "opponent_approval_team_id" TEXT,
ADD COLUMN     "opponent_approved_at" TIMESTAMP(3),
ADD COLUMN     "opponent_approved_by_id" TEXT,
ADD COLUMN     "opponent_declined_reason" VARCHAR(2000);

-- CreateIndex
CREATE INDEX "Game_opponent_approval_status_idx" ON "Game"("opponent_approval_status");

-- CreateIndex
CREATE INDEX "Game_opponent_approval_team_id_opponent_approval_status_idx" ON "Game"("opponent_approval_team_id", "opponent_approval_status");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_opponent_approved_by_id_fkey" FOREIGN KEY ("opponent_approved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
