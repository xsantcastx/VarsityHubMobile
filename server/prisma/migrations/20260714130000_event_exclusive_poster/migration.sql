-- Owner one-off feature (2026-07-14): an event may designate a single exclusive
-- poster. When set, only that user may post to the event. Nullable, no default,
-- no backfill — additive and safe to apply online (Postgres nullable column add
-- takes no table rewrite / no long lock).
ALTER TABLE "Event" ADD COLUMN "exclusive_poster_id" TEXT;
CREATE INDEX "Event_exclusive_poster_id_idx" ON "Event"("exclusive_poster_id");
