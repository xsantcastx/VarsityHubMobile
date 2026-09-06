-- CreateTable
CREATE TABLE "AdPurchaseIntent" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "client_transaction_id" UUID NOT NULL,
    "dates" TEXT[],
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "completed_transaction_id" TEXT,
    "last_error_code" VARCHAR(80),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdPurchaseIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPurchaseIntentItem" (
    "intent_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cents" INTEGER NOT NULL,

    CONSTRAINT "AdPurchaseIntentItem_pkey" PRIMARY KEY ("intent_id","sku")
);

-- CreateTable
CREATE TABLE "AdPurchaseReceipt" (
    "apple_transaction_id" VARCHAR(100) NOT NULL,
    "intent_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdPurchaseReceipt_pkey" PRIMARY KEY ("apple_transaction_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdPurchaseIntent_client_transaction_id_key" ON "AdPurchaseIntent"("client_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdPurchaseIntent_completed_transaction_id_key" ON "AdPurchaseIntent"("completed_transaction_id");

-- CreateIndex
CREATE INDEX "AdPurchaseIntent_user_id_status_idx" ON "AdPurchaseIntent"("user_id", "status");

-- CreateIndex
CREATE INDEX "AdPurchaseIntent_status_updated_at_idx" ON "AdPurchaseIntent"("status", "updated_at");

-- CreateIndex
CREATE INDEX "AdPurchaseReceipt_intent_id_idx" ON "AdPurchaseReceipt"("intent_id");

-- AddForeignKey
ALTER TABLE "AdPurchaseIntent" ADD CONSTRAINT "AdPurchaseIntent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPurchaseIntent" ADD CONSTRAINT "AdPurchaseIntent_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPurchaseIntent" ADD CONSTRAINT "AdPurchaseIntent_completed_transaction_id_fkey" FOREIGN KEY ("completed_transaction_id") REFERENCES "TransactionLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPurchaseIntentItem" ADD CONSTRAINT "AdPurchaseIntentItem_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "AdPurchaseIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPurchaseReceipt" ADD CONSTRAINT "AdPurchaseReceipt_intent_id_sku_fkey" FOREIGN KEY ("intent_id", "sku") REFERENCES "AdPurchaseIntentItem"("intent_id", "sku") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one unfinished checkout per ad, even across devices and processes.
CREATE UNIQUE INDEX "AdPurchaseIntent_one_open_ad" ON "AdPurchaseIntent" (ad_id)
  WHERE status IN ('pending', 'needs_action');
ALTER TABLE "AdPurchaseIntent" ADD CONSTRAINT "AdPurchaseIntent_completion_ledger"
  CHECK ((status = 'completed') = (completed_transaction_id IS NOT NULL));
ALTER TABLE "AdPurchaseIntent" ADD CONSTRAINT "AdPurchaseIntent_valid_state"
  CHECK (status IN ('pending', 'needs_action', 'completed'));
ALTER TABLE "AdPurchaseIntent" ADD CONSTRAINT "AdPurchaseIntent_bounded_dates"
  CHECK (cardinality(dates) BETWEEN 1 AND 56);
ALTER TABLE "AdPurchaseIntentItem" ADD CONSTRAINT "AdPurchaseIntentItem_valid_product"
  CHECK (sku IN ('MOND_THURS', 'FRI_SUN') AND quantity > 0 AND quantity <= 9 AND unit_cents > 0);
ALTER TABLE "AdPurchaseReceipt" ADD CONSTRAINT "AdPurchaseReceipt_positive_quantity"
  CHECK (quantity > 0 AND quantity <= 9);
