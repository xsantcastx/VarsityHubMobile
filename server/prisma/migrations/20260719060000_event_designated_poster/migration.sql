-- CreateTable
CREATE TABLE "EventDesignatedPoster" (
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "EventDesignatedPoster_pkey" PRIMARY KEY ("event_id", "user_id")
);

-- CreateIndex
CREATE INDEX "EventDesignatedPoster_user_id_idx" ON "EventDesignatedPoster"("user_id");

-- AddForeignKey
ALTER TABLE "EventDesignatedPoster" ADD CONSTRAINT "EventDesignatedPoster_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
