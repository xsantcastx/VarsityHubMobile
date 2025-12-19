-- AlterTable (idempotent)
ALTER TABLE "Organization"
	ADD COLUMN IF NOT EXISTS "formatted_address" TEXT,
	ADD COLUMN IF NOT EXISTS "place_id" TEXT;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_place_id_key" ON "Organization"("place_id");
