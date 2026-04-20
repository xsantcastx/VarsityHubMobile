-- CreateTable: GDPR / right-to-access self-serve data export.
-- A row is created when a user requests an export; a worker builds the ZIP
-- and updates status. Archives expire after the retention window (default
-- 7 days) and the cleanup cron flips status to 'expired' while keeping the
-- row as a metadata-only audit record.
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "storage_key" TEXT,
    "size_bytes" INTEGER,
    "error_category" TEXT,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "last_downloaded_at" TIMESTAMP(3),

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- Index: hot path for "list exports by user, newest first"
CREATE INDEX "DataExport_user_id_requested_at_idx" ON "DataExport"("user_id", "requested_at");

-- Index: cleanup cron scans by status + age
CREATE INDEX "DataExport_status_requested_at_idx" ON "DataExport"("status", "requested_at");

-- Foreign key: cascade on user hard-delete so the hard-delete cron doesn't
-- get blocked by pending exports. If a user is purged, their export
-- archives are orphaned in S3 — the cleanup cron will delete them when
-- expires_at passes. Acceptable because the archive is already encrypted
-- at rest and only accessible via short-lived signed URLs to the user.
ALTER TABLE "DataExport"
    ADD CONSTRAINT "DataExport_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
