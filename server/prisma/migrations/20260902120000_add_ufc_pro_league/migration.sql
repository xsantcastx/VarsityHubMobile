ALTER TYPE "ProLeague" ADD VALUE IF NOT EXISTS 'ufc';

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
) VALUES (
  'sports_league_ufc',
  'ufc',
  'UFC',
  'mma',
  'major',
  'mixed',
  'US',
  NULL,
  NULL,
  true
) ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "sport_slug" = EXCLUDED."sport_slug",
  "level" = EXCLUDED."level",
  "gender" = EXCLUDED."gender",
  "country_code" = EXCLUDED."country_code",
  "active" = EXCLUDED."active";
