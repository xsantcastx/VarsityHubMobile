-- Add optional custom_position column for storing position labels on team memberships
ALTER TABLE "TeamMembership"
ADD COLUMN "custom_position" TEXT;
