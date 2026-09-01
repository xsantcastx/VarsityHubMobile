CREATE TABLE "SportsLeague" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "sport_slug" VARCHAR(80) NOT NULL,
  "level" VARCHAR(40) NOT NULL,
  "gender" VARCHAR(40) NOT NULL,
  "country_code" VARCHAR(2),
  "provider" VARCHAR(60),
  "provider_league_id" VARCHAR(120),
  "active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SportsLeague_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SportsSeason" (
  "id" TEXT NOT NULL,
  "sports_league_id" TEXT NOT NULL,
  "season_key" VARCHAR(80) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "starts_on" TIMESTAMP(3),
  "ends_on" TIMESTAMP(3),
  "provider_season_id" VARCHAR(120),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SportsSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SportsIngestRun" (
  "id" TEXT NOT NULL,
  "sports_league_id" TEXT,
  "provider" VARCHAR(60) NOT NULL,
  "status" VARCHAR(40) NOT NULL,
  "window_from" TIMESTAMP(3),
  "window_to" TIMESTAMP(3),
  "fetched_count" INTEGER NOT NULL DEFAULT 0,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "message" VARCHAR(2000),
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "SportsIngestRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Event" ADD COLUMN "sports_league_id" TEXT;

CREATE UNIQUE INDEX "SportsLeague_slug_key" ON "SportsLeague"("slug");
CREATE INDEX "SportsLeague_sport_slug_active_idx" ON "SportsLeague"("sport_slug", "active");
CREATE INDEX "SportsLeague_level_active_idx" ON "SportsLeague"("level", "active");
CREATE INDEX "SportsLeague_gender_active_idx" ON "SportsLeague"("gender", "active");
CREATE INDEX "SportsLeague_provider_provider_league_id_idx" ON "SportsLeague"("provider", "provider_league_id");

CREATE UNIQUE INDEX "SportsSeason_sports_league_id_season_key_key" ON "SportsSeason"("sports_league_id", "season_key");
CREATE INDEX "SportsSeason_sports_league_id_is_current_idx" ON "SportsSeason"("sports_league_id", "is_current");
CREATE INDEX "SportsSeason_provider_season_id_idx" ON "SportsSeason"("provider_season_id");

CREATE INDEX "SportsIngestRun_sports_league_id_started_at_idx" ON "SportsIngestRun"("sports_league_id", "started_at");
CREATE INDEX "SportsIngestRun_provider_started_at_idx" ON "SportsIngestRun"("provider", "started_at");
CREATE INDEX "SportsIngestRun_status_started_at_idx" ON "SportsIngestRun"("status", "started_at");
CREATE INDEX "Event_sports_league_id_idx" ON "Event"("sports_league_id");

ALTER TABLE "SportsSeason"
  ADD CONSTRAINT "SportsSeason_sports_league_id_fkey"
  FOREIGN KEY ("sports_league_id") REFERENCES "SportsLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SportsIngestRun"
  ADD CONSTRAINT "SportsIngestRun_sports_league_id_fkey"
  FOREIGN KEY ("sports_league_id") REFERENCES "SportsLeague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_sports_league_id_fkey"
  FOREIGN KEY ("sports_league_id") REFERENCES "SportsLeague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SportsLeague" (
  "id",
  "slug",
  "name",
  "sport_slug",
  "level",
  "gender",
  "country_code",
  "provider",
  "provider_league_id",
  "active"
) VALUES
  ('sports_league_nfl', 'nfl', 'NFL', 'football', 'major', 'men', 'US', 'espn', 'football/nfl', true),
  ('sports_league_nba', 'nba', 'NBA', 'basketball', 'major', 'men', 'US', 'espn', 'basketball/nba', true),
  ('sports_league_wnba', 'wnba', 'WNBA', 'basketball', 'major', 'women', 'US', 'espn', 'basketball/wnba', true),
  ('sports_league_mlb', 'mlb', 'MLB', 'baseball', 'major', 'men', 'US', 'espn', 'baseball/mlb', true),
  ('sports_league_wwe', 'wwe', 'WWE', 'wrestling', 'major', 'mixed', 'US', 'thesportsdb', '4444', true),
  ('sports_league_ncaaf', 'ncaaf', 'NCAA Football', 'football', 'college', 'men', 'US', 'espn', 'football/college-football', true),
  ('sports_league_ncaamb', 'ncaamb', 'NCAA Men''s Basketball', 'basketball', 'college', 'men', 'US', 'espn', 'basketball/mens-college-basketball', true),
  ('sports_league_ncaawb', 'ncaawb', 'NCAA Women''s Basketball', 'basketball', 'college', 'women', 'US', 'espn', 'basketball/womens-college-basketball', true),
  ('sports_league_ncaabaseball', 'ncaabaseball', 'NCAA Baseball', 'baseball', 'college', 'men', 'US', 'espn', 'baseball/college-baseball', true),
  ('sports_league_ncaamhockey', 'ncaamhockey', 'NCAA Men''s Hockey', 'ice_hockey', 'college', 'men', 'US', 'espn', 'hockey/mens-college-hockey', true)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Event" e
SET "sports_league_id" = sl."id"
FROM "ProTeam" pt
JOIN "SportsLeague" sl ON sl."slug" = pt."league"::text
WHERE e."sports_league_id" IS NULL
  AND e."pro_external_ref" IS NOT NULL
  AND (e."pro_home_team_id" = pt."id" OR e."pro_away_team_id" = pt."id");
