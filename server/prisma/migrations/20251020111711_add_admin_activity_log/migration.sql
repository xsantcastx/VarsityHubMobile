-- CreateTable
CREATE TABLE "AdminActivityLog" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "admin_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActivityLog_admin_id_idx" ON "AdminActivityLog"("admin_id");

-- CreateIndex
CREATE INDEX "AdminActivityLog_target_type_idx" ON "AdminActivityLog"("target_type");

-- CreateIndex
CREATE INDEX "AdminActivityLog_target_id_idx" ON "AdminActivityLog"("target_id");

-- CreateIndex
CREATE INDEX "AdminActivityLog_timestamp_idx" ON "AdminActivityLog"("timestamp");
