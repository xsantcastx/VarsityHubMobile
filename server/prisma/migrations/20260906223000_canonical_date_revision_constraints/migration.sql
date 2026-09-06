-- Keep one BETWEEN expression per check. PostgreSQL dump/reparse can regroup
-- combined BETWEEN/AND expressions, changing pg_get_constraintdef output even
-- when the enforced predicate is equivalent. Separate checks round-trip exactly.
ALTER TABLE "AdPurchaseIntentRevision"
  DROP CONSTRAINT "AdPurchaseIntentRevision_bounded_dates",
  ADD CONSTRAINT "AdPurchaseIntentRevision_bounded_before"
    CHECK (cardinality(before_dates) BETWEEN 1 AND 56),
  ADD CONSTRAINT "AdPurchaseIntentRevision_bounded_after"
    CHECK (cardinality(after_dates) BETWEEN 1 AND 56);
-- Retain on application rollback; both constraints enforce the original bounds.
