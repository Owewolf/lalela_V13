-- Add quantity-aware inventory fields to listings.
ALTER TABLE "posts"
  ADD COLUMN "initial_quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "quantity_type" TEXT;

-- Add per-sale transactional fields for partial inventory sales.
ALTER TABLE "cat_transactions"
  ADD COLUMN "quantity_sold" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "unit_price_at_sale" DOUBLE PRECISION,
  ADD COLUMN "total_sale_value" DOUBLE PRECISION,
  ADD COLUMN "reversed_at" TIMESTAMP(3);

-- Backfill monetary sale fields for existing rows based on post pricing.
UPDATE "cat_transactions" ct
SET
  "unit_price_at_sale" = COALESCE(p."community_price", p."price", 0),
  "total_sale_value" = COALESCE(p."community_price", p."price", 0) * COALESCE(ct."quantity_sold", 1)
FROM "posts" p
WHERE ct."post_id" = p."id";
