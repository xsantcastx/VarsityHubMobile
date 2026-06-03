-- Add DB-level idempotency guards for Stripe payment identifiers.
-- PostgreSQL unique indexes allow multiple NULL values, so historical rows
-- without a Stripe identifier remain valid while duplicate non-null IDs are
-- rejected.
CREATE UNIQUE INDEX "TransactionLog_stripe_payment_intent_id_key"
ON "TransactionLog"("stripe_payment_intent_id");

CREATE UNIQUE INDEX "TransactionLog_stripe_subscription_id_key"
ON "TransactionLog"("stripe_subscription_id");
