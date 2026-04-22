/**
 * Stream 3 verification helper: audit drift between canonical User auth/onboarding
 * columns and the legacy preferences JSON compatibility fields.
 *
 * Usage:
 *   cd server
 *   DATABASE_URL=postgresql://test:test@localhost:5432/varsityhub_test npx tsx scripts/audit-user-auth-state-drift.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
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

function warn(label: string, rows: DriftRow[]) {
  console.log(`  ${YELLOW}WARN${RESET}  ${label} — ${rows.length} user(s)`);
  for (const row of rows.slice(0, 20)) {
    console.log(
      `        ${DIM}${row.id}${RESET}  column=${JSON.stringify(row.column_value)}  json=${JSON.stringify(row.json_value)}`
    );
  }
  if (rows.length > 20) {
    console.log(`        ${DIM}... and ${rows.length - 20} more${RESET}`);
  }
}

async function queryDrift(sql: TemplateStringsArray, ...values: unknown[]): Promise<DriftRow[]> {
  return prisma.$queryRaw<DriftRow[]>(sql, ...values);
}

async function main() {
  console.log(`${BOLD}Stream 3 Auth-State Drift Audit${RESET}`);
  console.log(`DATABASE_URL: ${DIM}${process.env.DATABASE_URL ? 'set' : 'missing'}${RESET}`);

  heading('Required Matches');

  const roleDrift = await queryDrift`
    SELECT u.id,
           u.role::text AS column_value,
           NULLIF(u.preferences->>'role', '') AS json_value
    FROM "User" u
    WHERE COALESCE(NULLIF(u.preferences->>'role', ''), 'fan') IS DISTINCT FROM u.role::text
    ORDER BY u.created_at DESC
  `;
  if (roleDrift.length === 0) pass('role column matches preferences.role');
  else fail('role column matches preferences.role', roleDrift);

  const onboardingDrift = await queryDrift`
    SELECT u.id,
           u.onboarding_completed::text AS column_value,
           COALESCE(u.preferences->>'onboarding_completed', 'false') AS json_value
    FROM "User" u
    WHERE COALESCE((u.preferences->>'onboarding_completed')::boolean, false) IS DISTINCT FROM u.onboarding_completed
    ORDER BY u.created_at DESC
  `;
  if (onboardingDrift.length === 0) pass('onboarding_completed column matches preferences.onboarding_completed');
  else fail('onboarding_completed column matches preferences.onboarding_completed', onboardingDrift);

  const orgDrift = await queryDrift`
    SELECT u.id,
           u.organization_id AS column_value,
           NULLIF(u.preferences->>'organization_id', '') AS json_value
    FROM "User" u
    WHERE NULLIF(u.preferences->>'organization_id', '') IS DISTINCT FROM u.organization_id
    ORDER BY u.created_at DESC
  `;
  if (orgDrift.length === 0) pass('organization_id column matches preferences.organization_id');
  else fail('organization_id column matches preferences.organization_id', orgDrift);

  const proceedingAsFanDrift = await queryDrift`
    SELECT u.id,
           u.proceeding_as_fan::text AS column_value,
           COALESCE(u.preferences->>'proceeding_as_fan', 'false') AS json_value
    FROM "User" u
    WHERE COALESCE((u.preferences->>'proceeding_as_fan')::boolean, false) IS DISTINCT FROM u.proceeding_as_fan
    ORDER BY u.created_at DESC
  `;
  if (proceedingAsFanDrift.length === 0) pass('proceeding_as_fan column matches preferences.proceeding_as_fan');
  else fail('proceeding_as_fan column matches preferences.proceeding_as_fan', proceedingAsFanDrift);

  heading('Optional Coach Agreement Fields');

  const agreementAcceptedAtDrift = await queryDrift`
    SELECT u.id,
           CASE WHEN u.coach_agreement_accepted_at IS NULL THEN NULL ELSE to_char(u.coach_agreement_accepted_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') END AS column_value,
           NULLIF(u.preferences->>'coach_agreement_accepted_at', '') AS json_value
    FROM "User" u
    WHERE NULLIF(u.preferences->>'coach_agreement_accepted_at', '') IS DISTINCT FROM
          CASE WHEN u.coach_agreement_accepted_at IS NULL THEN NULL ELSE to_char(u.coach_agreement_accepted_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') END
    ORDER BY u.created_at DESC
  `;
  if (agreementAcceptedAtDrift.length === 0) pass('coach_agreement_accepted_at column matches preferences.coach_agreement_accepted_at');
  else warn('coach_agreement_accepted_at column matches preferences.coach_agreement_accepted_at', agreementAcceptedAtDrift);

  const agreementVersionDrift = await queryDrift`
    SELECT u.id,
           CASE WHEN u.coach_agreement_version IS NULL THEN NULL ELSE u.coach_agreement_version::text END AS column_value,
           NULLIF(u.preferences->>'coach_agreement_version', '') AS json_value
    FROM "User" u
    WHERE NULLIF(u.preferences->>'coach_agreement_version', '') IS DISTINCT FROM
          CASE WHEN u.coach_agreement_version IS NULL THEN NULL ELSE u.coach_agreement_version::text END
    ORDER BY u.created_at DESC
  `;
  if (agreementVersionDrift.length === 0) pass('coach_agreement_version column matches preferences.coach_agreement_version');
  else warn('coach_agreement_version column matches preferences.coach_agreement_version', agreementVersionDrift);

  heading('Referential Integrity');

  const orphanedOrgRefs = await queryDrift`
    SELECT u.id,
           u.organization_id AS column_value,
           NULL AS json_value
    FROM "User" u
    LEFT JOIN "Organization" o ON o.id = u.organization_id
    WHERE u.organization_id IS NOT NULL
      AND o.id IS NULL
    ORDER BY u.created_at DESC
  `;
  if (orphanedOrgRefs.length === 0) pass('organization_id references existing Organization rows');
  else fail('organization_id references existing Organization rows', orphanedOrgRefs);

  const failures =
    roleDrift.length +
    onboardingDrift.length +
    orgDrift.length +
    proceedingAsFanDrift.length +
    orphanedOrgRefs.length;

  console.log();
  if (failures === 0) {
    console.log(`${GREEN}${BOLD}Auth-state drift audit passed.${RESET}`);
  } else {
    console.log(`${RED}${BOLD}Auth-state drift audit found ${failures} required mismatch(es).${RESET}`);
    process.exitCode = 1;
  }
}

main()
  .catch(err => {
    console.error(`${RED}audit-user-auth-state-drift failed:${RESET}`, err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
