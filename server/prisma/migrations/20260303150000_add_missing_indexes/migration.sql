-- Add missing indexes for frequently queried foreign key columns

-- Team.organization_id: queried when listing teams by organization
CREATE INDEX "Team_organization_id_idx" ON "Team"("organization_id");

-- Notification.actor_id: queried when joining actor data on notification feeds
CREATE INDEX "Notification_actor_id_idx" ON "Notification"("actor_id");

-- Ad.status: queried when filtering ads by status (active, draft, archived)
CREATE INDEX "Ad_status_idx" ON "Ad"("status");
