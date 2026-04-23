-- Hot-path indexes for Message conversation lookup and Story lazy expiry.
-- Production can still choose to build these concurrently out-of-band; on
-- fresh/local environments these CREATE INDEX IF NOT EXISTS statements keep
-- the migration chain self-healing and eliminate schema/index drift.

CREATE INDEX IF NOT EXISTS "Message_sender_id_recipient_id_idx"
  ON "Message" ("sender_id", "recipient_id");

CREATE INDEX IF NOT EXISTS "Story_game_id_expires_at_idx"
  ON "Story" ("game_id", "expires_at");
