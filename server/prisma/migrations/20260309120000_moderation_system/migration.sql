-- Add moderation fields to User
ALTER TABLE "User" ADD COLUMN "ban_reason" TEXT;
ALTER TABLE "User" ADD COLUMN "banned_until" TIMESTAMP(3);

-- UserWarning table for strike/warning system
CREATE TABLE "UserWarning" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "issued_by" TEXT,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "report_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWarning_pkey" PRIMARY KEY ("id")
);

-- Indexes for UserWarning
CREATE INDEX "UserWarning_user_id_idx" ON "UserWarning"("user_id");
CREATE INDEX "UserWarning_user_id_created_at_idx" ON "UserWarning"("user_id", "created_at");
CREATE INDEX "UserWarning_severity_idx" ON "UserWarning"("severity");

-- Foreign keys
ALTER TABLE "UserWarning" ADD CONSTRAINT "UserWarning_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserWarning" ADD CONSTRAINT "UserWarning_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
