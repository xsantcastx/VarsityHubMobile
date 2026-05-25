-- CreateTable: TeamJoinRequest
-- Allows athletes to self-request membership on a team.
-- Owners/managers approve or reject; on approval a TeamMembership is created.
-- Reuses OrganizationJoinRequestStatus enum (pending | approved | denied).

CREATE TABLE "TeamJoinRequest" (
    "id"               TEXT NOT NULL,
    "team_id"          TEXT NOT NULL,
    "user_id"          TEXT NOT NULL,
    "status"           "OrganizationJoinRequestStatus" NOT NULL DEFAULT 'pending',
    "message"          VARCHAR(500),
    "rejection_reason" VARCHAR(500),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at"      TIMESTAMP(3),
    "reviewed_by"      TEXT,

    CONSTRAINT "TeamJoinRequest_pkey" PRIMARY KEY ("id")
);

-- Unique: one active request per user+team
CREATE UNIQUE INDEX "TeamJoinRequest_team_id_user_id_key" ON "TeamJoinRequest"("team_id", "user_id");

-- Indexes for common query patterns
CREATE INDEX "TeamJoinRequest_team_id_status_idx" ON "TeamJoinRequest"("team_id", "status");
CREATE INDEX "TeamJoinRequest_user_id_status_idx" ON "TeamJoinRequest"("user_id", "status");

-- FK: team (cascade delete)
ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: user (cascade delete)
ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add TEAM_JOIN_REQUEST, TEAM_JOIN_APPROVED, TEAM_JOIN_REJECTED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_JOIN_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_JOIN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_JOIN_REJECTED';
