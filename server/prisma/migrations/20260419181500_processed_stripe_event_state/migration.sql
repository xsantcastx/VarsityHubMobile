-- AlterTable
ALTER TABLE "ProcessedStripeEvent"
ADD COLUMN "processed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "processing_started_at" TIMESTAMP(3),
ADD COLUMN "processed_at" TIMESTAMP(3),
ADD COLUMN "last_error" TEXT;

-- CreateIndex
CREATE INDEX "ProcessedStripeEvent_processed_idx" ON "ProcessedStripeEvent"("processed");
