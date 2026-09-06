-- PostgreSQL re-parses varchar-array IN predicates into a different expression
-- when pg_dump restores them. Explicit text literals retain identical definitions
-- across dump/restore, preserving strict schema parity without weakening checks.
BEGIN;
ALTER TABLE "AdPurchaseIntent" DROP CONSTRAINT "AdPurchaseIntent_valid_state";
ALTER TABLE "AdPurchaseIntent" ADD CONSTRAINT "AdPurchaseIntent_valid_state"
  CHECK (status::text IN ('pending'::text, 'needs_action'::text, 'completed'::text));
ALTER TABLE "AdPurchaseIntentItem" DROP CONSTRAINT "AdPurchaseIntentItem_valid_product";
ALTER TABLE "AdPurchaseIntentItem" ADD CONSTRAINT "AdPurchaseIntentItem_valid_product"
  CHECK (sku::text IN ('MOND_THURS'::text, 'FRI_SUN'::text) AND quantity > 0 AND quantity <= 9 AND unit_cents > 0);
DROP INDEX "AdPurchaseIntent_one_open_ad";
CREATE UNIQUE INDEX "AdPurchaseIntent_one_open_ad" ON "AdPurchaseIntent" (ad_id)
  WHERE status::text IN ('pending'::text, 'needs_action'::text);
COMMIT;
-- Rollback: retain these logically equivalent predicates and all payment data.
