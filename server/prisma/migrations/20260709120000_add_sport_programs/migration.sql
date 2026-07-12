-- CreateEnum
CREATE TYPE "TeamLevel" AS ENUM ('varsity', 'jv', 'freshman', 'middle_school', 'unified', 'other');

-- CreateEnum
CREATE TYPE "ProgramGender" AS ENUM ('boys', 'girls', 'coed');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "level" "TeamLevel",
ADD COLUMN     "program_id" TEXT;

-- CreateTable
CREATE TABLE "SportProgram" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sport" VARCHAR(100) NOT NULL,
    "gender" "ProgramGender" NOT NULL,
    "name" VARCHAR(120),
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SportProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SportProgram_organization_id_idx" ON "SportProgram"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "SportProgram_organization_id_sport_gender_key" ON "SportProgram"("organization_id", "sport", "gender");

-- CreateIndex
CREATE INDEX "Team_program_id_idx" ON "Team"("program_id");

-- AddForeignKey
ALTER TABLE "SportProgram" ADD CONSTRAINT "SportProgram_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "SportProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
