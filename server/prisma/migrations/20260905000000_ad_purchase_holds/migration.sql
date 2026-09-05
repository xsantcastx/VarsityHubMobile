-- Additive only. Legacy reservations must not be classified/deleted from ad-level
-- payment_status: Run Again could have mixed purchased and held dates there.
ALTER TABLE "AdReservation" ADD COLUMN "purchase_reference" TEXT;
CREATE INDEX "AdReservation_purchase_reference_idx" ON "AdReservation"("purchase_reference");
CREATE TABLE "AdSlotHold" (
  "id" TEXT NOT NULL,
  "ad_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "purchase_reference" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdSlotHold_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdSlotHold_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdSlotHold_ad_id_date_purchase_reference_key" ON "AdSlotHold"("ad_id", "date", "purchase_reference");
CREATE INDEX "AdSlotHold_expires_at_idx" ON "AdSlotHold"("expires_at");
CREATE INDEX "AdSlotHold_purchase_reference_idx" ON "AdSlotHold"("purchase_reference");
