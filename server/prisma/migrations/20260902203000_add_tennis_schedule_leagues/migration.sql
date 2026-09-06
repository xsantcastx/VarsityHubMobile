ALTER TYPE "ProLeague" ADD VALUE IF NOT EXISTS 'atp';
ALTER TYPE "ProLeague" ADD VALUE IF NOT EXISTS 'wta';

UPDATE "SportsLeague"
SET "provider" = 'espn',
    "provider_league_id" = 'tennis/atp',
    "active" = true
WHERE "slug" = 'atp';

UPDATE "SportsLeague"
SET "provider" = 'espn',
    "provider_league_id" = 'tennis/wta',
    "active" = true
WHERE "slug" = 'wta';
