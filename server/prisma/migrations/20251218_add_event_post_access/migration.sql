-- Add event_id field to Post model
ALTER TABLE "Post" ADD COLUMN "event_id" TEXT;

-- Add foreign key constraint for event_id
ALTER TABLE "Post" ADD CONSTRAINT "Post_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE SET NULL;

-- Add index for event_id queries
CREATE INDEX "Post_event_id_created_at_idx" ON "Post"("event_id", "created_at");

-- Create EventPostAccess table
CREATE TABLE "EventPostAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventPostAccess_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE,
    CONSTRAINT "EventPostAccess_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create unique constraint for event_id and user_id
CREATE UNIQUE INDEX "EventPostAccess_event_id_user_id_key" ON "EventPostAccess"("event_id", "user_id");

-- Create index for lookups
CREATE INDEX "EventPostAccess_event_id_user_id_expires_at_idx" ON "EventPostAccess"("event_id", "user_id", "expires_at");

-- Create index for cleanup queries
CREATE INDEX "EventPostAccess_user_id_expires_at_idx" ON "EventPostAccess"("user_id", "expires_at");

-- Add posts relation to Event model
-- (This is implicit in the foreign key above, no SQL needed)

-- Add eventPostAccess relation to Event and User models
-- (These are implicit in the foreign keys above, no SQL needed)
