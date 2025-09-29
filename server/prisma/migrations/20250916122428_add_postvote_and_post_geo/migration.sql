-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "admin1" TEXT,
ADD COLUMN     "country_code" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "PostVote" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostVote_post_id_created_at_idx" ON "PostVote"("post_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "PostVote_post_id_user_id_key" ON "PostVote"("post_id", "user_id");

-- AddForeignKey
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
