-- Additive audit ledger; old application versions can ignore this table.
-- Rollback the application first and retain this table to preserve purchase history.
CREATE TABLE "AdPurchaseIntentRevision" (
  "id" UUID NOT NULL,
  "intent_id" UUID NOT NULL,
  "before_dates" TEXT[] NOT NULL,
  "after_dates" TEXT[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdPurchaseIntentRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdPurchaseIntentRevision_bounded_dates" CHECK (
    cardinality(before_dates) BETWEEN 1 AND 56 AND
    cardinality(after_dates) BETWEEN 1 AND 56
  ),
  CONSTRAINT "AdPurchaseIntentRevision_intent_id_fkey" FOREIGN KEY ("intent_id")
    REFERENCES "AdPurchaseIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AdPurchaseIntentRevision_intent_id_created_at_idx"
  ON "AdPurchaseIntentRevision"("intent_id", "created_at");
