-- CreateTable
CREATE TABLE "EventPostingUnlock" (
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPostingUnlock_pkey" PRIMARY KEY ("user_id", "event_id")
);

-- CreateIndex
CREATE INDEX "EventPostingUnlock_event_id_idx" ON "EventPostingUnlock"("event_id");

-- AddForeignKey
ALTER TABLE "EventPostingUnlock" ADD CONSTRAINT "EventPostingUnlock_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPostingUnlock" ADD CONSTRAINT "EventPostingUnlock_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
