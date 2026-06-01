-- Persist structured in-chat context card data (listing/notice payload) on conversations.
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;
