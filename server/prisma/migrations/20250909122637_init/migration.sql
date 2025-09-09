-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT;

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE INDEX "Game_date_idx" ON "Game"("date");

-- CreateIndex
CREATE INDEX "Message_created_date_idx" ON "Message"("created_date");

-- CreateIndex
CREATE INDEX "Post_created_at_idx" ON "Post"("created_at");
