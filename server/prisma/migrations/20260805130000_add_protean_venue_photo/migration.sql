-- Free-use (Wikimedia Commons) stadium photo used as the pro game card backdrop.
-- Nullable and additive: existing rows keep NULL and the card falls back to the
-- team-color gradient, so this deploys with zero behavior change until seeded.
ALTER TABLE "ProTeam" ADD COLUMN "venue_photo_url" VARCHAR(500);
