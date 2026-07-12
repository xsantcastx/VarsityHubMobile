/**
 * Read-only prod migration-health check. No writes.
 *   - Is the Post.event_id column present? (was drifted/missing before #146 deploy)
 *   - Latest applied migrations in _prisma_migrations.
 *   - Any failed migration (blocks all future deploys)?
 *   - Is User.terms_accepted_at present yet? (should be absent until #150 deploys)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function colExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}`;
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  console.log('[check-migration-status] READ-ONLY. DB host:',
    (process.env.DATABASE_URL || '').replace(/^.*@/, '').replace(/\/.*$/, ''));

  console.log('\nColumn presence:');
  console.log('  Post.event_id        :', await colExists('Post', 'event_id'), '(expected true if #146 deploy applied migrations)');
  console.log('  User.terms_accepted_at:', await colExists('User', 'terms_accepted_at'), '(expected false until #150 deploys)');

  const applied = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM _prisma_migrations ORDER BY started_at DESC LIMIT 6`;
  console.log('\nLatest migrations (_prisma_migrations):');
  for (const m of applied) {
    const state = m.rolled_back_at ? 'ROLLED_BACK' : m.finished_at ? 'applied' : 'PENDING/FAILED';
    console.log(`  ${state.padEnd(14)} ${m.migration_name}`);
  }

  const failed = applied.filter(m => !m.finished_at && !m.rolled_back_at);
  console.log(failed.length ? `\n⚠ ${failed.length} unfinished migration(s) — would block deploys.` : '\n✓ No unfinished/failed migrations.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
