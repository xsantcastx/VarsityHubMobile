-- v2 refresh tokens: lookup by deterministic key_id, verify by bcrypt over
-- the secret half. Legacy v1 rows continue to be looked up by token_hash
-- (SHA-256) until they expire naturally; hash_version=1 marks them.

ALTER TABLE "RefreshToken"
  ADD COLUMN "key_id" TEXT,
  ADD COLUMN "hash_version" INTEGER NOT NULL DEFAULT 1;

-- Unique on key_id, but allow multiple NULLs (Postgres treats NULLs as
-- distinct in unique indexes). v1 rows leave key_id NULL forever; only v2
-- writes populate it, and they generate fresh random IDs.
CREATE UNIQUE INDEX "RefreshToken_key_id_key" ON "RefreshToken"("key_id");
