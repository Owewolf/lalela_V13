ALTER TABLE "user_businesses"
ADD COLUMN "image_imported_at" TIMESTAMP(3);

ALTER TABLE "user_businesses"
ADD COLUMN "google_place_id" TEXT;
