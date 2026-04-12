CREATE TABLE IF NOT EXISTS "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedStripeEvent_event_id_key" ON "ProcessedStripeEvent"("event_id");
CREATE INDEX IF NOT EXISTS "ProcessedStripeEvent_created_at_idx" ON "ProcessedStripeEvent"("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "PromoRedemption_promo_id_order_id_key" ON "PromoRedemption"("promo_id", "order_id");
