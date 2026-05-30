CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Game_approval_status_date_idx"
ON "Game" ("approval_status", "date");

CREATE INDEX IF NOT EXISTS "Game_approval_status_created_at_idx"
ON "Game" ("approval_status", "created_at");

CREATE INDEX IF NOT EXISTS "Event_approval_status_status_date_idx"
ON "Event" ("approval_status", "status", "date");

CREATE INDEX IF NOT EXISTS "Notification_user_id_read_at_created_at_idx"
ON "Notification" ("user_id", "read_at", "created_at");

CREATE INDEX IF NOT EXISTS "User_username_trgm_idx"
ON "User" USING GIN ("username" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_display_name_trgm_idx"
ON "User" USING GIN ("display_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Team_name_trgm_idx"
ON "Team" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Team_city_trgm_idx"
ON "Team" USING GIN ("city" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Team_state_trgm_idx"
ON "Team" USING GIN ("state" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Team_league_trgm_idx"
ON "Team" USING GIN ("league" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Team_sport_trgm_idx"
ON "Team" USING GIN ("sport" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Organization_name_trgm_idx"
ON "Organization" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Organization_description_trgm_idx"
ON "Organization" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Organization_sport_trgm_idx"
ON "Organization" USING GIN ("sport" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Game_title_trgm_idx"
ON "Game" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Game_location_trgm_idx"
ON "Game" USING GIN ("location" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Game_home_team_trgm_idx"
ON "Game" USING GIN ("home_team" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Game_away_team_trgm_idx"
ON "Game" USING GIN ("away_team" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Game_away_team_name_trgm_idx"
ON "Game" USING GIN ("away_team_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Event_title_trgm_idx"
ON "Event" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Event_location_trgm_idx"
ON "Event" USING GIN ("location" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Event_description_trgm_idx"
ON "Event" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Event_event_type_trgm_idx"
ON "Event" USING GIN ("event_type" gin_trgm_ops);
