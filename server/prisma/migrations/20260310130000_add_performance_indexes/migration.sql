-- User model: subscription_status and banned indexes
CREATE INDEX IF NOT EXISTS "User_subscription_status_idx" ON "User"("subscription_status");
CREATE INDEX IF NOT EXISTS "User_banned_idx" ON "User"("banned");

-- Post model: composite index on type + created_at
CREATE INDEX IF NOT EXISTS "Post_type_created_at_idx" ON "Post"("type", "created_at");

-- Game model: approval_status index
CREATE INDEX IF NOT EXISTS "Game_approval_status_idx" ON "Game"("approval_status");

-- Ad model: composite index on status + payment_status
CREATE INDEX IF NOT EXISTS "Ad_status_payment_status_idx" ON "Ad"("status", "payment_status");
