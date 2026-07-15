-- Owner rule (2026-07-15): default live post window becomes -1h -> +3h around
-- event start; all-day festivals (Fanatics Fest) need a longer geofenced live
-- window, so events may override the hours-after-start bound. Null = default
-- (3h). Nullable, no default, no backfill — additive and safe to apply online
-- (Postgres nullable column add takes no table rewrite / no long lock).
-- Rollback: ALTER TABLE "Event" DROP COLUMN "live_window_hours_after_start";
ALTER TABLE "Event" ADD COLUMN "live_window_hours_after_start" INTEGER;
