-- Add fan pitch marker and supporting index
ALTER TABLE "Event" ADD COLUMN "is_pitch" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Event_is_pitch_approval_status_idx" ON "Event"("is_pitch", "approval_status");
