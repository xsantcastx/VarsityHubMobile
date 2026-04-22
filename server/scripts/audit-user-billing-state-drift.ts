/**
 * Stream 5 verification helper: audit drift between canonical User billing
 * columns and the legacy preferences JSON compatibility fields.
 *
 * Usage:
 *   cd server
 *   DATABASE_URL=postgresql://test:test@localhost:5432/varsityhub_test npx tsx scripts/audit-user-billing-state-drift.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

type DriftRow = {
  id: string;
  column_value: string | null;
  json_value: string | null;
};

function heading(title: string) {
  console.log();
  console.log(`${BOLD}${CYAN}── ${title} ──${RESET}`);
}

function pass(label: string) {
  console.log(`  ${GREEN}PASS${RESET}  ${label}`);
}

function fail(label: string, rows: DriftRow[]) {
  console.log(`  ${RED}FAIL${RESET}  ${label} — ${rows.length} mismatched user(s)`);
  for (const row of rows.slice(0, 20)) {
    console.log(
      `        ${DIM}${row.id}${RESET}  column=${JSON.stringify(row.column_value)}  json=${JSON.stringify(row.json_value)}`
    );
  }
  if (rows.length > 20) {
    console.log(`        ${DIM}... and ${rows.length - 20} more${RESET}`);
  }
}

async function queryDrift(
  sql: TemplateStringsArray,
  ...values: unknown[]
): Promise<DriftRow[]> {
  return prisma.$queryRaw<DriftRow[]>(sql, ...values);
}

async function main() {
  console.log(`${BOLD}Stream 5 Billing-State Drift Audit${RESET}`);
  console.log(`DATABASE_URL: ${DIM}${process.env.DATABASE_URL ? 'set' : 'missing'}${RESET}`);

  heading('Required Matches');

  const planDrift = await queryDrift`
    SELECT u.id,
           u.plan::text AS column_value,
           COALESCE(NULLIF(lower(u.preferences->>'plan'), ''), CASE
             WHEN lower(coalesce(u.subscription_tier, '')) = 'pro' THEN 'legend'
             WHEN lower(coalesce(u.subscription_tier, '')) = 'premium' THEN 'veteran'
             ELSE 'rookie'
           END) AS json_value
    FROM "User" u
    WHERE COALESCE(NULLIF(lower(u.preferences->>'plan'), ''), CASE
            WHEN lower(coalesce(u.subscription_tier, '')) = 'pro' THEN 'legend'
            WHEN lower(coalesce(u.subscription_tier, '')) = 'premium' THEN 'veteran'
            ELSE 'rookie'
          END) IS DISTINCT FROM u.plan::text
    ORDER BY u.created_at DESC
  `;
  if (planDrift.length === 0) pass('plan column matches preferences.plan / subscription_tier fallback');
  else fail('plan column matches preferences.plan / subscription_tier fallback', planDrift);

  const pendingPlanDrift = await queryDrift`
    SELECT u.id,
           CASE WHEN u.pending_plan IS NULL THEN NULL ELSE u.pending_plan::text END AS column_value,
           NULLIF(lower(u.preferences->>'pending_plan'), '') AS json_value
    FROM "User" u
    WHERE NULLIF(lower(u.preferences->>'pending_plan'), '') IS DISTINCT FROM
          CASE WHEN u.pending_plan IS NULL THEN NULL ELSE u.pending_plan::text END
    ORDER BY u.created_at DESC
  `;
  if (pendingPlanDrift.length === 0) pass('pending_plan column matches preferences.pending_plan');
  else fail('pending_plan column matches preferences.pending_plan', pendingPlanDrift);

  const paymentPendingDrift = await queryDrift`
    SELECT u.id,
           u.payment_pending::text AS column_value,
           COALESCE(u.preferences->>'payment_pending', 'false') AS json_value
    FROM "User" u
    WHERE COALESCE((u.preferences->>'payment_pending')::boolean, false) IS DISTINCT FROM u.payment_pending
    ORDER BY u.created_at DESC
  `;
  if (paymentPendingDrift.length === 0) pass('payment_pending column matches preferences.payment_pending');
  else fail('payment_pending column matches preferences.payment_pending', paymentPendingDrift);

  const paymentApprovedDrift = await queryDrift`
    SELECT u.id,
           u.payment_approved::text AS column_value,
           COALESCE(u.preferences->>'payment_approved', 'false') AS json_value
    FROM "User" u
    WHERE COALESCE((u.preferences->>'payment_approved')::boolean, false) IS DISTINCT FROM u.payment_approved
    ORDER BY u.created_at DESC
  `;
  if (paymentApprovedDrift.length === 0) pass('payment_approved column matches preferences.payment_approved');
  else fail('payment_approved column matches preferences.payment_approved', paymentApprovedDrift);

  const failures =
    planDrift.length +
    pendingPlanDrift.length +
    paymentPendingDrift.length +
    paymentApprovedDrift.length;

  console.log();
  if (failures === 0) {
    console.log(`${GREEN}${BOLD}Billing-state drift audit passed.${RESET}`);
  } else {
    console.log(`${RED}${BOLD}Billing-state drift audit found ${failures} required mismatch(es).${RESET}`);
    process.exitCode = 1;
  }
}

main()
  .catch(err => {
    console.error(`${RED}audit-user-billing-state-drift failed:${RESET}`, err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
