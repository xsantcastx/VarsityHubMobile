-- AlterEnum
ALTER TYPE "ProgramGender" RENAME TO "TeamGender";

-- DropIndex
DROP INDEX "SportProgram_organization_id_sport_gender_key";

-- AlterTable
ALTER TABLE "SportProgram" DROP COLUMN "gender";

-- CreateIndex
CREATE UNIQUE INDEX "SportProgram_organization_id_sport_key" ON "SportProgram"("organization_id", "sport");

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "gender" "TeamGender";
