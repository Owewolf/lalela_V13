-- Add quantity-aware inventory fields to listings.
ALTER TABLE "posts"
  ADD "initial_quantity" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "posts"
  ADD "quantity_type" TEXT;

-- Add per-sale transactional fields for partial inventory sales.
ALTER TABLE "cat_transactions"
  ADD "quantity_sold" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "cat_transactions"
  ADD "unit_price_at_sale" DOUBLE PRECISION;

ALTER TABLE "cat_transactions"
  ADD "total_sale_value" DOUBLE PRECISION;

ALTER TABLE "cat_transactions"
  ADD "reversed_at" TIMESTAMP;

-- Backfill monetary sale fields for existing rows based on post pricing.
UPDATE "cat_transactions"
SET
  "unit_price_at_sale" = COALESCE(p."community_price", p."price", 0),
  "total_sale_value" = COALESCE(p."community_price", p."price", 0) * COALESCE("cat_transactions"."quantity_sold", 1)
FROM "posts" AS p
WHERE "cat_transactions"."post_id" = p."id";
