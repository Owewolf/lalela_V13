DELETE FROM "messages"
WHERE "message_type" = 'listing_snapshot';

DROP INDEX IF EXISTS "messages_snapshot_topic_unique";
DROP INDEX IF EXISTS "messages_snapshot_topic_idx";

ALTER TABLE "messages"
DROP COLUMN IF EXISTS "snapshot_pair_key",
DROP COLUMN IF EXISTS "snapshot_topic_type",
DROP COLUMN IF EXISTS "snapshot_source_id";
