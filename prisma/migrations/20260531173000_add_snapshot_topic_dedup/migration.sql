ALTER TABLE "messages"
ADD COLUMN "snapshot_pair_key" TEXT,
ADD COLUMN "snapshot_topic_type" TEXT,
ADD COLUMN "snapshot_source_id" TEXT;

UPDATE "messages" AS m
SET
	"snapshot_pair_key" = c."pair_key",
	"snapshot_topic_type" =
		CASE
			WHEN m."file_name" LIKE 'snapshot:listing:%' THEN 'listing'
			WHEN m."file_name" LIKE 'snapshot:notice:%' THEN 'notice'
			WHEN COALESCE(c."metadata"->>'type', '') = 'listing' THEN 'listing'
			WHEN COALESCE(c."metadata"->>'type', '') = 'notice' THEN 'notice'
			WHEN c."listing_id" IS NOT NULL THEN 'listing'
			WHEN c."notice_id" IS NOT NULL THEN 'notice'
			ELSE NULL
		END,
	"snapshot_source_id" =
		CASE
			WHEN m."file_name" LIKE 'snapshot:listing:%' THEN NULLIF(split_part(m."file_name", ':', 3), '')
			WHEN m."file_name" LIKE 'snapshot:notice:%' THEN NULLIF(split_part(m."file_name", ':', 3), '')
			WHEN m."file_name" LIKE 'snapshot:%' THEN NULLIF(split_part(m."file_name", ':', 2), '')
			WHEN c."listing_id" IS NOT NULL THEN c."listing_id"
			WHEN c."notice_id" IS NOT NULL THEN c."notice_id"
			ELSE NULL
		END
FROM "conversations" AS c
WHERE
	m."conversation_id" = c."id"
	AND m."message_type" = 'listing_snapshot';

WITH ranked AS (
	SELECT
		id,
		row_number() OVER (
			PARTITION BY "snapshot_pair_key", "snapshot_topic_type", "snapshot_source_id"
			ORDER BY "created_at" ASC, id ASC
		) AS rank
	FROM "messages"
	WHERE
		"snapshot_pair_key" IS NOT NULL
		AND "snapshot_topic_type" IS NOT NULL
		AND "snapshot_source_id" IS NOT NULL
)
UPDATE "messages"
SET
	"snapshot_pair_key" = NULL,
	"snapshot_topic_type" = NULL,
	"snapshot_source_id" = NULL
WHERE id IN (SELECT id FROM ranked WHERE rank > 1);

CREATE INDEX "messages_snapshot_topic_idx"
ON "messages" ("snapshot_pair_key", "snapshot_topic_type", "snapshot_source_id");

CREATE UNIQUE INDEX "messages_snapshot_topic_unique"
ON "messages" ("snapshot_pair_key", "snapshot_topic_type", "snapshot_source_id");
