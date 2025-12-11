/*
  Warnings:

  - You are about to drop the column `tournament_id` on the `Game` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_tournament_id_fkey";

-- DropIndex
DROP INDEX "Game_tournament_id_idx";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "tournament_id",
ADD COLUMN     "banner_image_url" TEXT,
ADD COLUMN     "stadium" TEXT,
ADD COLUMN     "tournament_organization_id" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "is_tournament" BOOLEAN DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "tournament_end_date" TIMESTAMP(3),
ADD COLUMN     "tournament_format" TEXT,
ADD COLUMN     "tournament_location" TEXT,
ADD COLUMN     "tournament_logo_url" TEXT,
ADD COLUMN     "tournament_rules" TEXT,
ADD COLUMN     "tournament_start_date" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Game_tournament_organization_id_idx" ON "Game"("tournament_organization_id");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_tournament_organization_id_fkey" FOREIGN KEY ("tournament_organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
