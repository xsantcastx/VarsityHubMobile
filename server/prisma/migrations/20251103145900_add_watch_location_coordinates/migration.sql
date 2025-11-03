-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "watch_location_lat" DOUBLE PRECISION,
ADD COLUMN     "watch_location_lng" DOUBLE PRECISION,
ADD COLUMN     "watch_location_place_id" TEXT;
