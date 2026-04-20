-- CreateTable
CREATE TABLE "AppleTransactionClaim" (
    "id" TEXT NOT NULL,
    "apple_transaction_id" TEXT NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "user_id" TEXT,
    "order_id" TEXT,
    "ad_id" TEXT,
    "metadata" JSONB,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppleTransactionClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppleTransactionClaim_apple_transaction_id_key" ON "AppleTransactionClaim"("apple_transaction_id");

-- CreateIndex
CREATE INDEX "AppleTransactionClaim_transaction_type_idx" ON "AppleTransactionClaim"("transaction_type");

-- CreateIndex
CREATE INDEX "AppleTransactionClaim_user_id_idx" ON "AppleTransactionClaim"("user_id");

-- CreateIndex
CREATE INDEX "AppleTransactionClaim_order_id_idx" ON "AppleTransactionClaim"("order_id");

-- CreateIndex
CREATE INDEX "AppleTransactionClaim_ad_id_idx" ON "AppleTransactionClaim"("ad_id");

-- CreateIndex
CREATE INDEX "AppleTransactionClaim_claimed_at_idx" ON "AppleTransactionClaim"("claimed_at");
