-- AlterTable
ALTER TABLE "charities" ADD COLUMN     "is_cat_charity" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "communities" ADD COLUMN     "cat_cycle_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cat_featured_charity_id" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "sold_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cat_transactions" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "cat_amount" DOUBLE PRECISION NOT NULL,
    "cat_percentage" DOUBLE PRECISION NOT NULL,
    "charity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cat_transactions_community_id_created_at_idx" ON "cat_transactions"("community_id", "created_at");

-- CreateIndex
CREATE INDEX "cat_transactions_post_id_idx" ON "cat_transactions"("post_id");

-- CreateIndex
CREATE INDEX "cat_transactions_seller_id_idx" ON "cat_transactions"("seller_id");

-- CreateIndex
CREATE INDEX "cat_transactions_charity_id_idx" ON "cat_transactions"("charity_id");

-- AddForeignKey
ALTER TABLE "cat_transactions" ADD CONSTRAINT "cat_transactions_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_transactions" ADD CONSTRAINT "cat_transactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_transactions" ADD CONSTRAINT "cat_transactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_transactions" ADD CONSTRAINT "cat_transactions_charity_id_fkey" FOREIGN KEY ("charity_id") REFERENCES "charities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

