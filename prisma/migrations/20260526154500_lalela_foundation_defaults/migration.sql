-- Add foundation preset metadata columns
ALTER TABLE "themes"
ADD COLUMN "preset_id" TEXT,
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'light';

-- Auto-migrate all existing community themes to Lalela Light foundation baseline
UPDATE "themes"
SET
  "preset_id" = 'lalela-light',
  "mode" = 'light',
  "name" = 'Lalela Light',
  "primary_color" = '#2D4B32',
  "secondary_color" = '#BD5D38',
  "background_color" = '#F2E8D5',
  "surface_color" = '#E8DDC8',
  "text_primary" = '#1A1C18',
  "text_secondary" = '#4A4F45',
  "border_radius" = '14px',
  "font_family" = 'Manrope',
  "icon_url" = NULL,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "community_id" IS NOT NULL;

-- Backfill missing community themes so every community has the foundation baseline
INSERT INTO "themes" (
  "id",
  "community_id",
  "preset_id",
  "mode",
  "name",
  "primary_color",
  "secondary_color",
  "background_color",
  "surface_color",
  "text_primary",
  "text_secondary",
  "border_radius",
  "font_family",
  "icon_url",
  "is_default",
  "created_at",
  "updated_at"
)
SELECT
  'theme_' || c."id" || '_lalela_light',
  c."id",
  'lalela-light',
  'light',
  'Lalela Light',
  '#2D4B32',
  '#BD5D38',
  '#F2E8D5',
  '#E8DDC8',
  '#1A1C18',
  '#4A4F45',
  '14px',
  'Manrope',
  NULL,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "communities" c
LEFT JOIN "themes" t
  ON t."community_id" = c."id"
WHERE t."community_id" IS NULL;
