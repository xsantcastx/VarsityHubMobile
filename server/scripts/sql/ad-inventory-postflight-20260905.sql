-- Read-only AFTER migration. Cross-check the paid + unexpired hold union.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SELECT COUNT(*) AS holds, COUNT(DISTINCT purchase_reference) AS pending_purchases,
       COUNT(*) FILTER (WHERE expires_at <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS expired_holds
FROM "AdSlotHold";
WITH inventory AS (
  SELECT r.ad_id, r.date, a.target_zip_code FROM "AdReservation" r JOIN "Ad" a ON a.id=r.ad_id
  WHERE a.payment_status IN ('paid','hold','pending_approval')
  UNION
  SELECT h.ad_id, h.date, a.target_zip_code FROM "AdSlotHold" h JOIN "Ad" a ON a.id=h.ad_id
  WHERE h.expires_at > CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
)
SELECT target_zip_code, date, COUNT(DISTINCT ad_id) AS campaigns
FROM inventory WHERE target_zip_code IS NOT NULL AND date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
GROUP BY target_zip_code,date HAVING COUNT(DISTINCT ad_id)>2 ORDER BY date,target_zip_code LIMIT 200;
COMMIT;
