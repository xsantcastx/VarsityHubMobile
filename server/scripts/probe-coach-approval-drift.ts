#!/usr/bin/env tsx
import '../src/lib/load-env.ts';
import { prisma } from '../src/lib/prisma.js';
import { findCoachApprovalDrift } from '../src/lib/coachApprovalDrift.js';

async function main() {
  const drift = await findCoachApprovalDrift(prisma, 100);
  if (drift.length === 0) {
    console.log(JSON.stringify({ ok: true, mismatches: 0 }, null, 2));
    return;
  }

  console.error(
    JSON.stringify(
      {
        ok: false,
        mismatches: drift.length,
        rows: drift,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
