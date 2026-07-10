-- AlterTable
ALTER TABLE "TeamFollow" ADD COLUMN     "via_program_id" TEXT;

-- CreateTable
CREATE TABLE "ProgramFollow" (
    "user_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramFollow_pkey" PRIMARY KEY ("user_id","program_id")
);

-- CreateIndex
CREATE INDEX "ProgramFollow_user_id_idx" ON "ProgramFollow"("user_id");

-- CreateIndex
CREATE INDEX "ProgramFollow_program_id_idx" ON "ProgramFollow"("program_id");

-- AddForeignKey
ALTER TABLE "TeamFollow" ADD CONSTRAINT "TeamFollow_via_program_id_fkey" FOREIGN KEY ("via_program_id") REFERENCES "SportProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramFollow" ADD CONSTRAINT "ProgramFollow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramFollow" ADD CONSTRAINT "ProgramFollow_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "SportProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
