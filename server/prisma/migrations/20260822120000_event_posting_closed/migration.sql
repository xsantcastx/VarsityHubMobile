-- Moderation kill switch: freeze all non-admin uploads to an event's page
-- (posts + stories) without deleting it. Enforced in geofencing.ts.
ALTER TABLE "Event" ADD COLUMN "posting_closed" BOOLEAN NOT NULL DEFAULT false;
