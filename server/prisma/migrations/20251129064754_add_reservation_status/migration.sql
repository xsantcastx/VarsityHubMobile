-- AlterTable
ALTER TABLE "AdReservation" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "stripe_session_id" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "phone_verification_code" TEXT,
ADD COLUMN     "phone_verification_expires" TIMESTAMP(3),
ADD COLUMN     "phone_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AdReservation_status_expires_at_idx" ON "AdReservation"("status", "expires_at");

-- CreateIndex
CREATE INDEX "AdReservation_stripe_session_id_idx" ON "AdReservation"("stripe_session_id");
