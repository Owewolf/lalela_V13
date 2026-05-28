/*
  Warnings:

  - You are about to drop the column `icon_url` on the `communities` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "charities" ADD COLUMN     "current_campaign_started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "communities" DROP COLUMN "icon_url";

-- CreateTable
CREATE TABLE "charity_campaign_snapshots" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "charity_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "goal_amount" DOUBLE PRECISION,
    "final_raised" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "final_potential" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "items_sold" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charity_campaign_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charity_campaign_snapshots_community_id_ended_at_idx" ON "charity_campaign_snapshots"("community_id", "ended_at");

-- CreateIndex
CREATE INDEX "charity_campaign_snapshots_charity_id_ended_at_idx" ON "charity_campaign_snapshots"("charity_id", "ended_at");

-- CreateIndex
CREATE INDEX "themes_community_id_idx" ON "themes"("community_id");

-- AddForeignKey
ALTER TABLE "charity_campaign_snapshots" ADD CONSTRAINT "charity_campaign_snapshots_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charity_campaign_snapshots" ADD CONSTRAINT "charity_campaign_snapshots_charity_id_fkey" FOREIGN KEY ("charity_id") REFERENCES "charities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
