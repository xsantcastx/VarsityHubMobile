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
  (
    'sports_league_fiba_womens_world_cup',
    'fiba_womens_world_cup',
    'FIBA Women''s Basketball World Cup',
    'basketball',
    'international',
    'women',
    NULL,
    'fiba',
    'fiba-womens-basketball-world-cup',
    true
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "sport_slug" = EXCLUDED."sport_slug",
  "level" = EXCLUDED."level",
  "gender" = EXCLUDED."gender",
  "country_code" = EXCLUDED."country_code",
  "provider" = EXCLUDED."provider",
  "provider_league_id" = EXCLUDED."provider_league_id",
  "active" = EXCLUDED."active";
