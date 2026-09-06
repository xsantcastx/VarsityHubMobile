-- CreateTable
CREATE TABLE "PushTicket" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "push_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "PushTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushTicket_ticket_id_key" ON "PushTicket"("ticket_id");

-- CreateIndex
CREATE INDEX "PushTicket_status_created_at_idx" ON "PushTicket"("status", "created_at");

-- CreateIndex
CREATE INDEX "PushTicket_user_id_idx" ON "PushTicket"("user_id");
