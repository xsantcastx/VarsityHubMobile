-- Empty-event cleanup: reversible soft-archive marker set by the
-- cleanup-empty-events cron (past 7-day upload window + zero posts). NULL = live.
ALTER TABLE "Event" ADD COLUMN "archived_at" TIMESTAMP(3);
CREATE INDEX "Event_archived_at_idx" ON "Event"("archived_at");
