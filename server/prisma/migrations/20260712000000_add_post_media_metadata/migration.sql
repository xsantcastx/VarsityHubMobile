-- Additive media metadata + provider-independence poster seam on Post.
-- All columns nullable with no default: safe on a live table, no rewrite,
-- every existing row stays NULL. See schema.prisma Post model for rationale.
ALTER TABLE "Post" ADD COLUMN "poster_url" TEXT;
ALTER TABLE "Post" ADD COLUMN "media_width" INTEGER;
ALTER TABLE "Post" ADD COLUMN "media_height" INTEGER;
ALTER TABLE "Post" ADD COLUMN "media_duration_s" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN "media_bytes" INTEGER;
