-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "community_id" TEXT,
    "name" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT NOT NULL,
    "background_color" TEXT NOT NULL,
    "surface_color" TEXT NOT NULL,
    "text_primary" TEXT NOT NULL,
    "text_secondary" TEXT NOT NULL,
    "border_radius" TEXT NOT NULL,
    "font_family" TEXT NOT NULL,
    "icon_url" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "themes_community_id_key" ON "themes"("community_id");

-- CreateIndex
CREATE INDEX "themes_is_default_idx" ON "themes"("is_default");

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
