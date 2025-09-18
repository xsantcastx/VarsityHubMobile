/*
  Warnings:

  - The primary key for the `PostUpvote` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `PostUpvote` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "PostUpvote_post_id_user_id_key";

-- AlterTable
ALTER TABLE "GameVote" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PostUpvote" DROP CONSTRAINT "PostUpvote_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "PostUpvote_pkey" PRIMARY KEY ("post_id", "user_id");

-- RenameForeignKey
ALTER TABLE "PostUpvote" RENAME CONSTRAINT "PostVote_post_id_fkey" TO "PostUpvote_post_id_fkey";

-- RenameForeignKey
ALTER TABLE "PostUpvote" RENAME CONSTRAINT "PostVote_user_id_fkey" TO "PostUpvote_user_id_fkey";
