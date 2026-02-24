-- CreateTable
CREATE TABLE "TeamFollow" (
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamFollow_pkey" PRIMARY KEY ("user_id","team_id")
);

-- CreateTable
CREATE TABLE "OrganizationFollow" (
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationFollow_pkey" PRIMARY KEY ("user_id","organization_id")
);

-- CreateIndex
CREATE INDEX "TeamFollow_user_id_idx" ON "TeamFollow"("user_id");

-- CreateIndex
CREATE INDEX "TeamFollow_team_id_idx" ON "TeamFollow"("team_id");

-- CreateIndex
CREATE INDEX "OrganizationFollow_user_id_idx" ON "OrganizationFollow"("user_id");

-- CreateIndex
CREATE INDEX "OrganizationFollow_organization_id_idx" ON "OrganizationFollow"("organization_id");

-- AddForeignKey
ALTER TABLE "TeamFollow" ADD CONSTRAINT "TeamFollow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamFollow" ADD CONSTRAINT "TeamFollow_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollow" ADD CONSTRAINT "OrganizationFollow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFollow" ADD CONSTRAINT "OrganizationFollow_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
