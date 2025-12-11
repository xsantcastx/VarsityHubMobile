/*
  Warnings:

  - Added the required column `updated_at` to the `Organization` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "group" TEXT,
ADD COLUMN     "round" TEXT,
ADD COLUMN     "stadium_capacity" INTEGER,
ADD COLUMN     "stadium_name" TEXT,
ADD COLUMN     "tournament_id" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "opened_year" INTEGER,
ADD COLUMN     "stadium_name" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'organization',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Game_tournament_id_idx" ON "Game"("tournament_id");

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
