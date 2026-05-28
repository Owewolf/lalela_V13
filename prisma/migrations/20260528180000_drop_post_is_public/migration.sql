-- Drop the post visibility flag. Every listing is now implicitly public —
-- it always carries the active charity (CAT by default, the featured charity
-- when a CAT cycle is on) and a derived public price.
ALTER TABLE "posts" DROP COLUMN "is_public";
