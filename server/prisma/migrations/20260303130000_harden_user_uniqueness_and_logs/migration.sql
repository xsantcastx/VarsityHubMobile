-- Normalize duplicate usernames before enforcing uniqueness.
WITH ranked_usernames AS (
  SELECT
    id,
    username,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(username)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM "User"
  WHERE username IS NOT NULL
),
duplicate_usernames AS (
  SELECT
    id,
    username,
    rn
  FROM ranked_usernames
  WHERE rn > 1
)
UPDATE "User" AS u
SET username = (
  LEFT(
    COALESCE(NULLIF(REGEXP_REPLACE(LOWER(du.username), '[^a-z0-9_.]', '', 'g'), ''), 'user'),
    12
  )
  || '_' || du.rn::TEXT || '_' || SUBSTRING(u.id FROM 1 FOR 4)
)
FROM duplicate_usernames AS du
WHERE u.id = du.id;

-- Normalize duplicate Stripe customer IDs before enforcing uniqueness.
WITH ranked_stripe_customers AS (
  SELECT
    id,
    stripe_customer_id,
    ROW_NUMBER() OVER (
      PARTITION BY stripe_customer_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM "User"
  WHERE stripe_customer_id IS NOT NULL
)
UPDATE "User" AS u
SET stripe_customer_id = NULL
FROM ranked_stripe_customers AS rs
WHERE u.id = rs.id
  AND rs.rn > 1;

-- Add uniqueness constraints and performance index.
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripe_customer_id_key" ON "User"("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "Message_conversation_id_idx" ON "Message"("conversation_id");

-- Preserve financial records when users are deleted.
ALTER TABLE "TransactionLog" DROP CONSTRAINT IF EXISTS "TransactionLog_user_id_fkey";
ALTER TABLE "TransactionLog"
  ADD CONSTRAINT "TransactionLog_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
