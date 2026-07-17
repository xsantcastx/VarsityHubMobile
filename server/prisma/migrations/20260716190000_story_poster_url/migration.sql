-- Add nullable poster_url for video-story thumbnails (generated lazily via
-- Cloudinary upload-by-URL). Additive and backward-compatible.
ALTER TABLE "Story" ADD COLUMN "poster_url" TEXT;
