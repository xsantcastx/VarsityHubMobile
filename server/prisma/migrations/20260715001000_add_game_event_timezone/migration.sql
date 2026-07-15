-- Capture the creator's IANA timezone on games and events so server-rendered
-- emails (cancel / approve / update) can show the correct local time rather
-- than the server's UTC. Additive + nullable — existing rows stay null and fall
-- back to the prior behavior. Audit 2026-07-14 (Phase 5 email-tz).
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(64);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(64);
