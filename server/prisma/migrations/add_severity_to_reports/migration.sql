-- CreateIndex
CREATE TABLE IF NOT EXISTS abuseReportSeverity (
  id TEXT PRIMARY KEY,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add severity column to abuseReport with CHECK constraint
ALTER TABLE abuseReport
ADD COLUMN severity VARCHAR(50) DEFAULT 'warning' CHECK (
  severity IN ('warning', 'content_removal', 'suspend_7_days', 'suspend_45_days', 'permanent_ban')
);

-- Add index for filtering by severity
CREATE INDEX IF NOT EXISTS abuseReport_severity_idx ON abuseReport(severity);
CREATE INDEX IF NOT EXISTS abuseReport_status_severity_idx ON abuseReport(status, severity);
