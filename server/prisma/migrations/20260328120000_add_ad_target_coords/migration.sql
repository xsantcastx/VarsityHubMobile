-- Add pre-computed coordinates to Ad for DB-level geofencing
-- Populated on ad create/update from target_zip_code
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "target_lat" DOUBLE PRECISION;
ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "target_lng" DOUBLE PRECISION;

-- Composite index for bounding-box range queries on the for-feed endpoint
CREATE INDEX IF NOT EXISTS "Ad_target_lat_target_lng_idx" ON "Ad" ("target_lat", "target_lng");
