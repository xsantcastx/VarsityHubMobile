-- AlterTable
ALTER TABLE "Ad" ADD COLUMN     "banner_fit_mode" TEXT DEFAULT 'fill',
ADD COLUMN     "target_url" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Message_recipient_id_read_idx" ON "Message"("recipient_id", "read");
