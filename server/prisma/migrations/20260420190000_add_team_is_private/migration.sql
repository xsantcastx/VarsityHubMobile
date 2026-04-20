-- Team privacy flag.
-- Defaults to false so existing teams retain current public-discoverable
-- behavior. Setting true hides the team from public search and gates the
-- roster + full profile to members, followers, and org admins.

ALTER TABLE "Team"
    ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Team_is_private_idx" ON "Team"("is_private");
