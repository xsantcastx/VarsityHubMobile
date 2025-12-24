-- CreateTable
CREATE TABLE "HostingRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "venue" TEXT,
    "requested_dates" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostingRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HostingRequest" ADD CONSTRAINT "HostingRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "HostingRequest_user_id_status_idx" ON "HostingRequest"("user_id", "status");

-- CreateIndex
CREATE INDEX "HostingRequest_created_at_idx" ON "HostingRequest"("created_at");
