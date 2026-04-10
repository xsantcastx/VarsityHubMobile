-- Trigram indexes for case-insensitive LIKE/ILIKE search performance
-- Run ONCE against production DB via Railway's psql or a migration tool.
--
-- Why: Prisma's `contains` + `mode: insensitive` generates ILIKE queries.
-- Standard B-tree indexes don't help with ILIKE '%term%' — they only accelerate
-- prefix matches. GIN indexes with pg_trgm support substring matching.
--
-- Usage: psql $DATABASE_URL -f scripts/add-trigram-indexes.sql

-- Step 1: Enable the trigram extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: User search (username, display_name, email)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_username_trgm
  ON "User" USING gin (username gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_display_name_trgm
  ON "User" USING gin (display_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email_trgm
  ON "User" USING gin (email gin_trgm_ops);

-- Step 3: Team search (name, city, state, league, sport)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_name_trgm
  ON "Team" USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_city_trgm
  ON "Team" USING gin (city gin_trgm_ops);

-- Step 4: Organization search (name, description, sport)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_name_trgm
  ON "Organization" USING gin (name gin_trgm_ops);

-- Step 5: Event search (title, description, location)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_title_trgm
  ON "Event" USING gin (title gin_trgm_ops);

-- Done. Verify with:
-- SELECT indexname FROM pg_indexes WHERE indexname LIKE '%trgm%';
