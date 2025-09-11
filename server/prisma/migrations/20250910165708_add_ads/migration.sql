-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "business_name" TEXT,
    "banner_url" TEXT,
    "target_zip_code" TEXT,
    "radius" INTEGER DEFAULT 45,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_user_id_created_at_idx" ON "Ad"("user_id", "created_at");

-- Backfill placeholder Ads for existing reservations to satisfy FK
INSERT INTO "Ad" ("id", "status", "payment_status")
SELECT DISTINCT "ad_id", 'draft', 'unpaid'
FROM "AdReservation"
WHERE "ad_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "AdReservation" ADD CONSTRAINT "AdReservation_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "Ad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
