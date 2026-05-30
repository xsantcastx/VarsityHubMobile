-- Support index-seek pagination for notification feeds ordered by created_at/id.
CREATE INDEX "Notification_user_id_created_at_id_idx"
ON "Notification"("user_id", "created_at", "id");

CREATE INDEX "Notification_user_id_read_at_created_at_id_idx"
ON "Notification"("user_id", "read_at", "created_at", "id");
