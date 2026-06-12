-- Trigram GIN indexes for /search ILIKE '%q%' queries. B-tree indexes cannot
-- serve infix matches, so every unified-search request sequential-scans all
-- five tables. Postgres only uses BitmapOr when EVERY arm of a table's OR is
-- indexable, so each table gets all of its searched columns covered.
-- Tables are small today (instant build); this is growth headroom.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- User: username, display_name
CREATE INDEX IF NOT EXISTS "User_username_trgm_idx" ON "User" USING GIN (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_display_name_trgm_idx" ON "User" USING GIN (display_name gin_trgm_ops);

-- Team: name, city, state, league, sport
CREATE INDEX IF NOT EXISTS "Team_name_trgm_idx" ON "Team" USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Team_city_trgm_idx" ON "Team" USING GIN (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Team_state_trgm_idx" ON "Team" USING GIN (state gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Team_league_trgm_idx" ON "Team" USING GIN (league gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Team_sport_trgm_idx" ON "Team" USING GIN (sport gin_trgm_ops);

-- Organization: name, description, sport
CREATE INDEX IF NOT EXISTS "Organization_name_trgm_idx" ON "Organization" USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Organization_description_trgm_idx" ON "Organization" USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Organization_sport_trgm_idx" ON "Organization" USING GIN (sport gin_trgm_ops);

-- Game: title, location, home_team, away_team, away_team_name
CREATE INDEX IF NOT EXISTS "Game_title_trgm_idx" ON "Game" USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Game_location_trgm_idx" ON "Game" USING GIN (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Game_home_team_trgm_idx" ON "Game" USING GIN (home_team gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Game_away_team_trgm_idx" ON "Game" USING GIN (away_team gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Game_away_team_name_trgm_idx" ON "Game" USING GIN (away_team_name gin_trgm_ops);

-- Event: title, location, description, event_type
CREATE INDEX IF NOT EXISTS "Event_title_trgm_idx" ON "Event" USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Event_location_trgm_idx" ON "Event" USING GIN (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Event_description_trgm_idx" ON "Event" USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Event_event_type_trgm_idx" ON "Event" USING GIN (event_type gin_trgm_ops);
