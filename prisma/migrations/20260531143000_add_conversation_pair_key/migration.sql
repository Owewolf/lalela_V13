-- Add deterministic pair key for direct 1-on-1 conversation reuse.
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "pair_key" TEXT;

-- Populate pair_key for existing direct conversations with exactly two participants.
WITH ranked_participants AS (
  SELECT
    cp.conversation_id,
    cp.user_id,
    ROW_NUMBER() OVER (PARTITION BY cp.conversation_id ORDER BY cp.user_id) AS rn,
    COUNT(*) OVER (PARTITION BY cp.conversation_id) AS participant_count
  FROM "conversation_participants" cp
), paired AS (
  SELECT
    rp1.conversation_id,
    rp1.user_id AS user_a,
    rp2.user_id AS user_b
  FROM ranked_participants rp1
  JOIN ranked_participants rp2
    ON rp1.conversation_id = rp2.conversation_id
   AND rp1.rn = 1
   AND rp2.rn = 2
  WHERE rp1.participant_count = 2
)
UPDATE "conversations" c
SET "pair_key" = LEAST(p.user_a, p.user_b) || ':' || GREATEST(p.user_a, p.user_b)
FROM paired p
WHERE c.id = p.conversation_id
  AND c.type = 'direct'
  AND c.pair_key IS NULL;

-- Remove duplicate pair_key rows (keep oldest conversation id) to satisfy unique index creation.
WITH duplicates AS (
  SELECT
    id,
    pair_key,
    ROW_NUMBER() OVER (PARTITION BY pair_key ORDER BY "created_at" ASC, id ASC) AS rn
  FROM "conversations"
  WHERE pair_key IS NOT NULL
)
UPDATE "conversations" c
SET "pair_key" = NULL
FROM duplicates d
WHERE c.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "conversations_pair_key_key" ON "conversations"("pair_key");
CREATE INDEX IF NOT EXISTS "conversations_pair_key_idx" ON "conversations"("pair_key");
