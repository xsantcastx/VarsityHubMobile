-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "location" TEXT,
ADD COLUMN     "org_type" TEXT,
ADD COLUMN     "zip_code" TEXT;

-- CreateTable
CREATE TABLE "OrganizationJoinRequest" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,

    CONSTRAINT "OrganizationJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationJoinRequest_organization_id_status_idx" ON "OrganizationJoinRequest"("organization_id", "status");

-- CreateIndex
CREATE INDEX "OrganizationJoinRequest_user_id_status_idx" ON "OrganizationJoinRequest"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationJoinRequest_organization_id_user_id_key" ON "OrganizationJoinRequest"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "Organization_zip_code_idx" ON "Organization"("zip_code");

-- CreateIndex
CREATE INDEX "Organization_location_idx" ON "Organization"("location");

-- AddForeignKey
ALTER TABLE "OrganizationJoinRequest" ADD CONSTRAINT "OrganizationJoinRequest_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationJoinRequest" ADD CONSTRAINT "OrganizationJoinRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
