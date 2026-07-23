-- Reconcile schema.prisma <-> migration history (drift discovered 2026-07-23).
--
-- Background: `prisma migrate diff --from-migrations --to-schema-datamodel`
-- emitted 25 statements on main. 22 of them were spurious DROP INDEXes for
-- objects that migrations DO create (the search trigram indexes and the User
-- billing-state indexes) but that schema.prisma never declared — those are
-- fixed schema-side in this same commit, with no SQL and no prod change.
--
-- The 3 statements below are REAL drift: schema.prisma has been ahead of the
-- migration history since ca8c2ae5 (2026-04-02), which edited schema.prisma
-- without generating a migration. This migration closes that gap.
--
-- Verified against production (Postgres-TnGR) before writing, on 2026-07-23:
--   * neither enum value exists in prod                          -> both adds are real
--   * TransactionLog has 0 rows, 0 non-null apple_transaction_id  -> 0 duplicates
--   * TransactionLog_apple_transaction_id_key exists as a PARTIAL unique index
--
-- Rollback: see the down-migration note at the bottom of this file.

-- ── 1. Enum values the application already writes ───────────────────────────
--
-- These are NOT cosmetic. Both are written by live code against an enum that
-- does not contain them, so both writes fail with Postgres 22P02:
--
--   'RECEIVED'                    <- lib/appleNotificationDedup.ts:29
--   'SUBSCRIPTION_RENEWAL_FAILED' <- routes/payments.ts:4452
--
-- The first is the dedup write at the top of the Apple S2S webhook. It fails,
-- the route's catch maps it to receiptState=null, and the handler returns 503
-- (fail-closed, by design). Net effect: EVERY Apple App Store Server
-- Notification is rejected and never processed. Adding the value re-enables the
-- webhook. There are no Apple subscribers in prod today, so nothing has been
-- lost yet — this is a latent outage, not an active one.
--
-- ADD VALUE inside a transaction is allowed on PG 12+ (prod is 17.7) provided
-- the new value is not USED in the same transaction. Nothing here uses it.
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWAL_FAILED';

-- ── 2. TransactionLog.apple_transaction_id unique index ─────────────────────
--
-- schema.prisma declares `apple_transaction_id String? @unique`, which Prisma
-- models as a plain (non-partial) unique index. Production instead has a
-- PARTIAL unique index of the same name, created by 20260415141954_v102_hardening:
--
--   CREATE UNIQUE INDEX "TransactionLog_apple_transaction_id_key"
--     ON "TransactionLog"(apple_transaction_id) WHERE apple_transaction_id IS NOT NULL;
--
-- Prisma cannot represent partial indexes, so it ignores the existing one and
-- keeps emitting a CREATE for the full index — which would collide on the name.
-- We therefore drop and recreate under the same name.
--
-- This is behaviour-preserving: Postgres treats NULLs as distinct in a unique
-- index, so a full unique index on a nullable column already permits unlimited
-- NULLs. The partial predicate was redundant. The only real difference is that
-- NULL rows now occupy index entries, which is irrelevant here (0 rows in prod).
--
-- The uniqueness guarantee this backs is the TOCTOU close in routes/payments.ts
-- (Apple IAP replay) and the notificationUUID dedup above — both rely on the
-- P2002 raised by this constraint, which is unaffected by the change.
DROP INDEX IF EXISTS "TransactionLog_apple_transaction_id_key";
CREATE UNIQUE INDEX "TransactionLog_apple_transaction_id_key"
  ON "TransactionLog" ("apple_transaction_id");

-- ── Rollback ────────────────────────────────────────────────────────────────
-- Postgres cannot remove an enum value, so the enum adds are forward-only.
-- They are additive and unused by existing rows, so leaving them in place is
-- harmless. To restore the partial index shape:
--
--   DROP INDEX IF EXISTS "TransactionLog_apple_transaction_id_key";
--   CREATE UNIQUE INDEX "TransactionLog_apple_transaction_id_key"
--     ON "TransactionLog"("apple_transaction_id") WHERE "apple_transaction_id" IS NOT NULL;
