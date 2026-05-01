/*
  Warnings:

  - You are about to drop the column `sender_id` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the `BlacklistedEmail` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "communities" ADD COLUMN     "guided_setup_required" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "sender_id",
DROP COLUMN "text",
DROP COLUMN "type",
ADD COLUMN     "file_name" TEXT;

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "isPublic",
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "BlacklistedEmail";

-- CreateTable
CREATE TABLE "blacklisted_emails" (
    "email" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_uid" TEXT,

    CONSTRAINT "blacklisted_emails_pkey" PRIMARY KEY ("email")
);
