# Stream 1 — Production Index Rollout Runbook

## Scope

Two `@@index` declarations are in `server/prisma/schema.prisma` but no migration
creates them in Postgres. Prisma client types already reflect them, so the
drift is invisible to `tsc` — but the underlying queries are still scanning the
full table in production.

| Model   | Index                       | Hot query it accelerates                                                                               |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Message | `(sender_id, recipient_id)` | Conversation-pair lookup in `messages.ts:114-119` (DM thread load)                                     |
| Story   | `(game_id, expires_at)`     | Per-game lazy-expiry sweep in `gameStories.ts` (`deleteMany WHERE game_id = X AND expires_at < now()`) |

`Message` in production is the table most at risk of a long table lock during
a naïve index build. `Story` is smaller but still user-facing during the sweep.
Both must be created with `CREATE INDEX CONCURRENTLY`.

## Why not just `prisma migrate deploy`

Prisma wraps each migration file in a transaction. Postgres forbids
`CREATE INDEX CONCURRENTLY` inside a transaction. A standard migration would
either fail at runtime or silently fall back to a locking `CREATE INDEX` that
blocks DMs and story writes for the duration of the build (minutes on a large
Message table).

The path of least risk is:

1. Apply `CREATE INDEX CONCURRENTLY` against Railway's production Postgres via
   `psql` (outside Prisma).
2. After a clean build, create a no-op Prisma migration that Prisma will mark
   applied on every environment — so fresh environments get the index and
   `prisma migrate status` stays clean.

## Preconditions

- Pick a low-traffic window. `CONCURRENTLY` doesn't lock writes, but the build
  still consumes IO and CPU on the primary.
- Confirm no active `VACUUM FULL` or long-running transactions on Message.
  `SELECT pid, now() - xact_start AS age FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY age DESC LIMIT 5;`
- Confirm `maintenance_work_mem` is reasonable for the build. Railway default
  is fine for these index sizes.

## Apply steps

### 1. Connect to Railway production

```sh
railway link                       # select capable-trust → api
railway connect Postgres           # spawns psql against production DB
```

Or use the `DATABASE_URL` from `railway variables` and `psql "$DATABASE_URL"`
directly. Do this on a trusted machine — this is prod credentials.

### 2. Confirm the indexes don't already exist

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('Message', 'Story')
  AND indexname LIKE ANY (ARRAY['%sender_id_recipient_id%', '%game_id_expires_at%']);
```

If either row comes back, skip that `CREATE INDEX` and jump to step 5.

### 3. Build the Message index

```sql
-- Runs outside a transaction. Does NOT block reads or writes on Message.
-- Expected duration: proportional to Message row count. On Railway's current
-- DB this is on the order of seconds to low minutes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Message_sender_id_recipient_id_idx"
  ON "Message" ("sender_id", "recipient_id");
```

Monitor progress:

```sql
-- While running, in a second session:
SELECT now() - query_start AS elapsed, state, query
FROM pg_stat_activity
WHERE query LIKE '%Message_sender_id_recipient_id_idx%';
```

If the statement aborts (network blip, manual cancel), Postgres leaves an
`INVALID` index entry you MUST drop before retrying:

```sql
SELECT indexrelid::regclass, indisvalid
FROM pg_index
WHERE indexrelid = 'Message_sender_id_recipient_id_idx'::regclass;
-- If indisvalid = false:
DROP INDEX CONCURRENTLY "Message_sender_id_recipient_id_idx";
-- Then retry the CREATE INDEX CONCURRENTLY.
```

### 4. Build the Story index

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Story_game_id_expires_at_idx"
  ON "Story" ("game_id", "expires_at");
```

Same monitoring + retry semantics as Message.

### 5. Verify

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE (tablename = 'Message' AND indexname = 'Message_sender_id_recipient_id_idx')
   OR (tablename = 'Story' AND indexname = 'Story_game_id_expires_at_idx');
```

Both rows should return with the expected definitions. Spot-check query plans:

```sql
-- Pick a real sender/recipient pair from your Message table.
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "Message"
WHERE sender_id = '<a_real_user_id>' AND recipient_id = '<another_user_id>'
ORDER BY created_at DESC
LIMIT 50;
-- Plan should show "Index Scan using Message_sender_id_recipient_id_idx"
-- (possibly combined with Message_sender_id_created_at_idx for the ORDER BY).
```

### 6. Commit the no-op migration

After production is verified, commit this migration so:

- Fresh local environments get the indexes automatically (they'll run the
  `CREATE INDEX IF NOT EXISTS` happily — no `CONCURRENTLY` needed on an empty DB).
- `prisma migrate status` stays clean on all environments.

Create `server/prisma/migrations/20260422210000_add_message_story_hotpath_indexes/migration.sql`:

```sql
-- Hot-path indexes for Message conversation lookup and Story lazy expiry.
-- Production was applied out-of-band via CREATE INDEX CONCURRENTLY (see
-- docs/release/STREAM_1_INDEX_RUNBOOK.md). These IF NOT EXISTS statements
-- are no-ops on any DB where the index was already built manually, and
-- correctly initialize fresh environments.

CREATE INDEX IF NOT EXISTS "Message_sender_id_recipient_id_idx"
  ON "Message" ("sender_id", "recipient_id");

CREATE INDEX IF NOT EXISTS "Story_game_id_expires_at_idx"
  ON "Story" ("game_id", "expires_at");
```

Then on each environment that had the index applied manually:

```sh
npx prisma migrate resolve --applied 20260422210000_add_message_story_hotpath_indexes
```

Railway won't need this step — its autodeploy will run `migrate deploy`, hit the
`IF NOT EXISTS`, and mark the migration applied naturally.

## Rollback

If the indexes cause unexpected behavior (wrong plan, unexpected write amplification,
space pressure), drop without locking:

```sql
DROP INDEX CONCURRENTLY IF EXISTS "Message_sender_id_recipient_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Story_game_id_expires_at_idx";
```

Then remove the `@@index` lines from `schema.prisma` in a follow-up PR and
create a Prisma migration mirroring the drops so fresh environments don't
re-create them.

## Trigger conditions for rollback

- p99 write latency on `Message` or `Story` increases > 50 % post-build
- Disk usage on Railway grows unexpectedly (> 15 %) after the build
- Any query plan regression on Message reads (the new index should strictly
  be additive — Postgres picks whichever composite is cheaper per query)

## Post-apply checklist

- [ ] `pg_indexes` shows both indexes
- [ ] `EXPLAIN` on a known DM thread uses `Message_sender_id_recipient_id_idx`
- [ ] `EXPLAIN` on a `deleteMany WHERE game_id = X AND expires_at < now()` uses `Story_game_id_expires_at_idx`
- [ ] No `INVALID` indexes left behind (`SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid`)
- [ ] No-op migration committed and applied / resolved on every environment
- [ ] `prisma migrate status` clean on Railway
- [ ] `npm run audit:pre-release` clean (enum-drift check will also silently
      validate this once we extend it to `@@index` declarations — see below)

## Follow-up: extend pre-release-audit.sh to catch index drift

The enum-drift check we landed in `scripts/pre-release-audit.sh` covers enum
values. A parallel check for `@@index` declarations in `schema.prisma` vs
`CREATE INDEX` statements in `prisma/migrations/` would have caught this class
of drift at commit time. Low-effort extension; worth adding after the runbook
is executed so we don't re-introduce this drift shape.
