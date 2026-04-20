-- Parental consent flow — token storage + request timestamp.
--
-- The existing minors-foundation migration introduced `parent_email`,
-- `parental_consent_status`, and `parental_consent_at`. This migration adds
-- the two fields the email-link consent flow needs:
--   - `parental_consent_requested_at` — starts the 14-day expiry clock
--   - `parental_consent_token_hash`   — SHA-256 of the single-use consent token
--
-- Stored as NULLABLE with no default; existing rows stay untouched. New columns
-- are populated when a minor's `complete-onboarding` call triggers the flow.

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "parental_consent_requested_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "parental_consent_token_hash"   VARCHAR(128);

-- Query by token hash when the parent clicks the consent link. Partial index
-- skips the million rows that have no active consent request.
CREATE INDEX IF NOT EXISTS "User_parental_consent_token_hash_idx"
    ON "User"("parental_consent_token_hash")
    WHERE "parental_consent_token_hash" IS NOT NULL;

-- Query by requested_at for the auto-expire cron.
CREATE INDEX IF NOT EXISTS "User_parental_consent_requested_at_idx"
    ON "User"("parental_consent_requested_at")
    WHERE "parental_consent_requested_at" IS NOT NULL;
