-- Catalog presence is not evidence of an importer. Preserve existing event-backed
-- entries and all event data, while removing empty unsupported filters.
UPDATE "SportsLeague" l SET active=false, updated_at=now()
WHERE l.active=true AND (l.provider IS NULL OR l.provider_league_id IS NULL)
AND NOT EXISTS (SELECT 1 FROM "Event" e WHERE e.sports_league_id=l.id);
-- Rollback is a reviewed per-league activation after a provider is connected;
-- do not blindly re-enable every row or remove its historical events.
