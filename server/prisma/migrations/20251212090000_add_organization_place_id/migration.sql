-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "formatted_address" TEXT,
ADD COLUMN     "place_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_place_id_key" ON "Organization"("place_id");
