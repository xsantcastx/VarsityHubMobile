-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('AD_PURCHASE', 'SUBSCRIPTION_PURCHASE', 'SUBSCRIPTION_RENEWAL', 'SUBSCRIPTION_CANCEL', 'REFUND', 'PROMO_REDEMPTION');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TransactionLog" (
    "id" TEXT NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "stripe_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "stripe_subscription_id" TEXT,
    "user_id" TEXT,
    "user_email" TEXT,
    "order_id" TEXT,
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "stripe_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "net_cents" INTEGER NOT NULL DEFAULT 0,
    "promo_code" TEXT,
    "promo_discount_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "payment_method" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionLog_stripe_session_id_key" ON "TransactionLog"("stripe_session_id");

-- CreateIndex
CREATE INDEX "TransactionLog_user_id_idx" ON "TransactionLog"("user_id");

-- CreateIndex
CREATE INDEX "TransactionLog_stripe_session_id_idx" ON "TransactionLog"("stripe_session_id");

-- CreateIndex
CREATE INDEX "TransactionLog_transaction_type_idx" ON "TransactionLog"("transaction_type");

-- CreateIndex
CREATE INDEX "TransactionLog_status_idx" ON "TransactionLog"("status");

-- CreateIndex
CREATE INDEX "TransactionLog_created_at_idx" ON "TransactionLog"("created_at");

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
