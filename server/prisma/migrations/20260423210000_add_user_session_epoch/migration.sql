-- Add session_epoch counter for single-session enforcement.
-- Bumped on every successful login / password reset; embedded as `se`
-- claim in access-token JWTs so a new login immediately invalidates every
-- prior token for the same user.
ALTER TABLE "User" ADD COLUMN "session_epoch" INTEGER NOT NULL DEFAULT 0;
