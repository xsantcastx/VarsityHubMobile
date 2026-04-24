-- CreateEnum
CREATE TYPE "CoachApplicationStatus" AS ENUM ('submitted', 'approved', 'rejected', 'superseded');

-- CreateTable
CREATE TABLE "CoachApplication" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "CoachApplicationStatus" NOT NULL DEFAULT 'submitted',
    "organization_name" VARCHAR(255) NOT NULL,
    "org_type" VARCHAR(100),
    "location" VARCHAR(500),
    "zip_code" VARCHAR(20),
    "place_id" VARCHAR(255),
    "supporting_document_url" VARCHAR(2000),
    "background_url" VARCHAR(2000),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachApplication_user_id_created_at_idx" ON "CoachApplication"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "CoachApplication_user_id_status_created_at_idx" ON "CoachApplication"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "CoachApplication_status_created_at_idx" ON "CoachApplication"("status", "created_at");

-- AddForeignKey
ALTER TABLE "CoachApplication" ADD CONSTRAINT "CoachApplication_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
