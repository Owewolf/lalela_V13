-- Add card token columns to theme state
ALTER TABLE "themes"
ADD COLUMN "card_surface_color" TEXT,
ADD COLUMN "card_surface_muted_color" TEXT,
ADD COLUMN "card_border_color" TEXT;

-- Backfill all existing themes with stable defaults by mode
UPDATE "themes"
SET
  "card_surface_color" = COALESCE("card_surface_color", "surface_color", CASE WHEN "mode" = 'dark' THEN '#252822' ELSE '#FAF6EF' END),
  "card_surface_muted_color" = COALESCE("card_surface_muted_color", CASE WHEN "mode" = 'dark' THEN '#1F211D' ELSE '#F6EFE4' END),
  "card_border_color" = COALESCE("card_border_color", CASE WHEN "mode" = 'dark' THEN '#3A3F36' ELSE '#E2D7C3' END),
  "updated_at" = CURRENT_TIMESTAMP;

-- Enforce required theme card tokens
ALTER TABLE "themes"
ALTER COLUMN "card_surface_color" SET NOT NULL,
ALTER COLUMN "card_surface_muted_color" SET NOT NULL,
ALTER COLUMN "card_border_color" SET NOT NULL;
