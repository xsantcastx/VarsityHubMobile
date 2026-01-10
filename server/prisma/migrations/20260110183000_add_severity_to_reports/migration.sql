-- CreateIndex
CREATE TABLE IF NOT EXISTS "AbuseReportSeverity" (
  id TEXT PRIMARY KEY,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add severity column to AbuseReport with CHECK constraint
ALTER TABLE "AbuseReport"
ADD COLUMN IF NOT EXISTS severity VARCHAR(50) DEFAULT 'warning' CHECK (
  severity IN ('warning', 'content_removal', 'suspend_7_days', 'suspend_45_days', 'permanent_ban')
);

-- Add index for filtering by severity
CREATE INDEX IF NOT EXISTS "AbuseReport_severity_idx" ON "AbuseReport"(severity);
CREATE INDEX IF NOT EXISTS "AbuseReport_status_severity_idx" ON "AbuseReport"(status, severity);
