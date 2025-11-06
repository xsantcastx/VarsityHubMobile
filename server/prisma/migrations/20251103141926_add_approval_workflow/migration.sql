-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "approval_status" TEXT NOT NULL DEFAULT 'approved',
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "created_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
