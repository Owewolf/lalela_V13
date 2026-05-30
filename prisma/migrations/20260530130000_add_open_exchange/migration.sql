-- Add persisted Open Exchange flag to listings.
ALTER TABLE "posts"
  ADD "is_open_exchange" BOOLEAN NOT NULL DEFAULT false;
