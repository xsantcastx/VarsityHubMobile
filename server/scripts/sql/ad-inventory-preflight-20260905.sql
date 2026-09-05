-- Read-only. Safe before OR after the additive migration. Run against the
-- explicitly selected DATABASE_URL; never source a repository .env implicitly.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

-- Summary of legacy/ambiguous inventory. NULL provenance is not proof of nonpayment.
SELECT a.payment_status, COUNT(DISTINCT a.id) AS ads,
       COUNT(r.id) AS reservations,
       COUNT(r.id) FILTER (WHERE r.date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date) AS upcoming_reservations,
       COUNT(r.id) FILTER (WHERE to_jsonb(r)->>'purchase_reference' IS NULL) AS reservations_without_purchase_reference
FROM "Ad" a LEFT JOIN "AdReservation" r ON r.ad_id = a.id
GROUP BY a.payment_status ORDER BY a.payment_status;

-- These require ledger/provider reconciliation; Run Again may have mixed old
-- paid dates and new checkout dates. DO NOT reset or delete from this list.
SELECT a.id AS ad_id, a.status, a.payment_status,
       COUNT(r.id) AS reservation_count,
       MIN(r.date) AS first_date, MAX(r.date) AS last_date,
       EXISTS (SELECT 1 FROM "TransactionLog" t WHERE t.order_id = a.id
         AND t.transaction_type = 'AD_PURCHASE' AND t.status = 'COMPLETED') AS has_completed_purchase
FROM "Ad" a JOIN "AdReservation" r ON r.ad_id = a.id
WHERE a.payment_status IN ('hold','pending_approval')
GROUP BY a.id ORDER BY a.updated_at ASC LIMIT 200;

-- Paid campaign records with missing inventory may need reconstruction from the ledger.
SELECT COUNT(*) AS paid_ads_without_reservations
FROM "Ad" a WHERE a.payment_status = 'paid'
AND NOT EXISTS (SELECT 1 FROM "AdReservation" r WHERE r.ad_id = a.id);

-- Oversold legacy inventory; count campaigns, not ledger events.
SELECT a.target_zip_code, r.date, COUNT(DISTINCT a.id) AS campaigns
FROM "AdReservation" r JOIN "Ad" a ON a.id = r.ad_id
WHERE a.payment_status IN ('paid','hold','pending_approval')
AND a.target_zip_code IS NOT NULL
AND r.date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
GROUP BY a.target_zip_code, r.date
HAVING COUNT(DISTINCT a.id) > 2
ORDER BY r.date, a.target_zip_code LIMIT 200;

-- Existing retriable/recovery ledger work; no PII or raw provider payloads.
SELECT status, COUNT(*) AS ad_purchase_transactions
FROM "TransactionLog" WHERE transaction_type = 'AD_PURCHASE'
GROUP BY status ORDER BY status;
SELECT event_type, processed, COUNT(*) AS events
FROM "ProcessedStripeEvent"
WHERE event_type IN ('charge.refunded','charge.dispute.created')
GROUP BY event_type, processed ORDER BY event_type, processed;
COMMIT;
