-- Pro sports events and team pages (2026-07-23).
-- See docs/superpowers/specs/2026-07-23-pro-sports-events-design.md
--
-- Purely additive: one enum, two new tables, three nullable Event columns.
-- No existing column is altered and no existing row is touched, so this is
-- safe under `prisma migrate deploy` on the Railway start path.
--
-- NOTE: this migration was hand-written rather than generated, because
-- `prisma migrate diff --from-migrations` against this tree emits ~22 unrelated
-- DROP INDEX statements (the search trigram indexes) plus two enum additions
-- and a TransactionLog unique index — all pre-existing drift between the
-- committed migrations and schema.prisma. None of that belongs to this change
-- and dropping the search indexes in production would be an outage.

-- CreateEnum
CREATE TYPE "ProLeague" AS ENUM ('nfl', 'nba', 'wnba', 'mlb', 'wwe');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "pro_away_team_id" TEXT,
ADD COLUMN     "pro_external_ref" VARCHAR(200),
ADD COLUMN     "pro_home_team_id" TEXT;

-- CreateTable
CREATE TABLE "ProTeam" (
    "id" TEXT NOT NULL,
    "league" "ProLeague" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "short_name" VARCHAR(60) NOT NULL,
    "abbreviation" VARCHAR(8),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "conference" VARCHAR(60),
    "division" VARCHAR(60),
    "venue_name" VARCHAR(200),
    "venue_address" VARCHAR(500),
    "venue_lat" DOUBLE PRECISION,
    "venue_lng" DOUBLE PRECISION,
    "timezone" VARCHAR(64),
    "primary_color" VARCHAR(20),
    "external_ref" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProTeamFollow" (
    "user_id" TEXT NOT NULL,
    "pro_team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProTeamFollow_pkey" PRIMARY KEY ("user_id","pro_team_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProTeam_external_ref_key" ON "ProTeam"("external_ref");

-- CreateIndex
CREATE INDEX "ProTeam_league_active_idx" ON "ProTeam"("league", "active");

-- CreateIndex
CREATE INDEX "ProTeam_name_idx" ON "ProTeam"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProTeam_league_name_key" ON "ProTeam"("league", "name");

-- CreateIndex
CREATE INDEX "ProTeamFollow_user_id_idx" ON "ProTeamFollow"("user_id");

-- CreateIndex
CREATE INDEX "ProTeamFollow_pro_team_id_idx" ON "ProTeamFollow"("pro_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "Event_pro_external_ref_key" ON "Event"("pro_external_ref");

-- CreateIndex
CREATE INDEX "Event_pro_home_team_id_date_idx" ON "Event"("pro_home_team_id", "date");

-- CreateIndex
CREATE INDEX "Event_pro_away_team_id_date_idx" ON "Event"("pro_away_team_id", "date");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_pro_home_team_id_fkey" FOREIGN KEY ("pro_home_team_id") REFERENCES "ProTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_pro_away_team_id_fkey" FOREIGN KEY ("pro_away_team_id") REFERENCES "ProTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProTeamFollow" ADD CONSTRAINT "ProTeamFollow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProTeamFollow" ADD CONSTRAINT "ProTeamFollow_pro_team_id_fkey" FOREIGN KEY ("pro_team_id") REFERENCES "ProTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
