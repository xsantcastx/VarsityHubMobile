CREATE TYPE "AdBannerModerationStatus" AS ENUM ('clean', 'flagged', 'error');

ALTER TABLE "Ad"
ADD COLUMN "banner_moderation_status" "AdBannerModerationStatus",
ADD COLUMN "banner_moderation_labels" JSONB,
ADD COLUMN "banner_moderation_score" DOUBLE PRECISION,
ADD COLUMN "banner_moderation_provider" VARCHAR(50),
ADD COLUMN "banner_moderation_error" VARCHAR(500),
ADD COLUMN "banner_moderated_at" TIMESTAMP(3);

CREATE INDEX "Ad_banner_moderation_status_idx" ON "Ad"("banner_moderation_status");
