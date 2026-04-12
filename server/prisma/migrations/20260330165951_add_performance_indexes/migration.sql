-- DropIndex
DROP INDEX "AdReservation_ad_id_date_idx";

-- DropIndex
DROP INDEX "OrganizationInvite_organization_id_email_idx";

-- DropIndex
DROP INDEX "TeamInvite_team_id_email_idx";

-- CreateIndex
CREATE INDEX "Follows_follower_id_status_idx" ON "Follows"("follower_id", "status");

-- CreateIndex
CREATE INDEX "Organization_admin_approved_idx" ON "Organization"("admin_approved");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "OrganizationInvite_email_status_idx" ON "OrganizationInvite"("email", "status");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organization_id_role_status_idx" ON "OrganizationMembership"("organization_id", "role", "status");

-- CreateIndex
CREATE INDEX "TeamInvite_email_status_idx" ON "TeamInvite"("email", "status");

-- CreateIndex
CREATE INDEX "TeamMembership_team_id_role_status_idx" ON "TeamMembership"("team_id", "role", "status");

-- CreateIndex
CREATE INDEX "User_approval_status_idx" ON "User"("approval_status");
