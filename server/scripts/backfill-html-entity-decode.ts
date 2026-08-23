/**
 * One-time backfill: decode HTML-entity-corrupted text fields written before
 * the stripHtml() fix (sanitize-html re-escaped plain "&" into "&amp;" on
 * every save, so e.g. "Swimming & Diving" was stored as "Swimming &amp;
 * Diving" — and, on a second save, "&amp;amp; Diving"). The write-side fix
 * (server/src/lib/sanitizeHtml.ts) stops new corruption; this repairs rows
 * already saved before it landed. Scans every model/column that ever routed
 * through stripHtml() per `grep -rn "stripHtml(" server/src/routes`.
 *
 * Dry-run by default. Pass --apply to write. Safe to re-run (idempotent —
 * decodeCorruptedValue on already-clean text is a no-op, and the WHERE
 * clause only matches rows that still contain a re-escaped entity).
 *
 *   npx tsx scripts/backfill-html-entity-decode.ts            # dry run
 *   npx tsx scripts/backfill-html-entity-decode.ts --apply    # write
 *
 * NOT wired into start.sh — run manually against a target DB.
 */
import { prisma } from '../src/lib/prisma.js';
import { stripHtml } from '../src/lib/sanitizeHtml.js';

const APPLY = process.argv.includes('--apply');
const BATCH = 500;
const ENTITY_PATTERN = /&(amp|lt|gt|quot|#39);/;

// Direct-message content, group chat content, and bios are private/personal —
// dry-run logging must never print their actual text (see finding #4).
const PRIVATE_COLUMNS = new Set(['message.content', 'groupChatMessage.content', 'user.bio']);

export function needsEntityDecode(value: string | null | undefined): boolean {
  if (!value) return false;
  return ENTITY_PATTERN.test(value);
}

export function decodeCorruptedValue(value: string): string {
  return stripHtml(value);
}

// A value saved through the old buggy code path more than once (e.g.
// "&amp;amp; Diving") is escaped multiple layers deep. Peel one layer per
// iteration until it stabilizes so a single backfill run fully repairs it
// (see finding #9) — capped so a pathological input can't loop forever.
export function decodeUntilStable(value: string, maxIterations = 5): string {
  let current = value;
  for (let i = 0; i < maxIterations; i++) {
    const next = decodeCorruptedValue(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

type ColumnTarget = {
  model: 'team' | 'post' | 'pollOption' | 'game' | 'event' | 'ad' | 'organization' | 'user' | 'teamMembership' | 'groupChatMessage' | 'message';
  column: string;
};

// One entry per stripHtml() call site found via
// `grep -rn "stripHtml(" server/src/routes --include="*.ts"`.
const TARGETS: ColumnTarget[] = [
  { model: 'team', column: 'name' },
  { model: 'team', column: 'description' },
  { model: 'team', column: 'sport' },
  { model: 'team', column: 'city' },
  { model: 'team', column: 'state' },
  { model: 'team', column: 'league' },
  { model: 'team', column: 'venue_address' },
  { model: 'post', column: 'title' },
  { model: 'post', column: 'content' },
  { model: 'pollOption', column: 'text' },
  { model: 'game', column: 'title' },
  { model: 'game', column: 'location' },
  { model: 'game', column: 'description' },
  { model: 'game', column: 'watch_location' },
  { model: 'game', column: 'destination' },
  { model: 'game', column: 'away_team_name' },
  { model: 'event', column: 'title' },
  { model: 'event', column: 'description' },
  { model: 'ad', column: 'contact_name' },
  { model: 'ad', column: 'business_name' },
  { model: 'ad', column: 'description' },
  { model: 'organization', column: 'description' },
  { model: 'user', column: 'display_name' },
  { model: 'user', column: 'bio' },
  { model: 'teamMembership', column: 'custom_position' },
  { model: 'groupChatMessage', column: 'content' },
  { model: 'message', column: 'content' },
];

async function backfillColumn(target: ColumnTarget): Promise<{ scanned: number; fixed: number }> {
  const { model, column } = target;
  let scanned = 0;
  let fixed = 0;
  let cursor: string | null = null;

  for (;;) {
    const delegate = (prisma as any)[model];
    const rows: Array<{ id: string; [key: string]: any }> = await delegate.findMany({
      where: { [column]: { contains: '&' } },
      select: { id: true, [column]: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    for (const row of rows) {
      const current: string | null = row[column];
      if (!needsEntityDecode(current)) continue;
      const decoded = decodeUntilStable(current!);
      if (decoded === current) continue;
      fixed += 1;
      if (APPLY) {
        await delegate.update({ where: { id: row.id }, data: { [column]: decoded } });
      } else {
        const key = `${model}.${column}`;
        if (PRIVATE_COLUMNS.has(key)) {
          console.log(`  [${key}] ${row.id}: ${current!.length} chars -> ${decoded.length} chars`);
        } else {
          console.log(`  [${key}] ${row.id}: "${current}" -> "${decoded}"`);
        }
      }
    }
  }

  return { scanned, fixed };
}

async function main(): Promise<void> {
  const summary: Record<string, { scanned: number; fixed: number }> = {};
  for (const target of TARGETS) {
    const key = `${target.model}.${target.column}`;
    summary[key] = await backfillColumn(target);
  }

  console.log(`\n${APPLY ? 'Backfill complete' : 'DRY RUN (no writes)'}:`);
  let totalFixed = 0;
  for (const [key, { scanned, fixed }] of Object.entries(summary)) {
    if (scanned === 0 && fixed === 0) continue;
    console.log(`  ${key}: scanned ${scanned}, ${APPLY ? 'fixed' : 'would fix'} ${fixed}`);
    totalFixed += fixed;
  }
  if (!APPLY && totalFixed > 0) {
    console.log('\nRe-run with --apply to write these changes.');
  }
}

// Only run when this file is executed directly (e.g. `npx tsx
// scripts/backfill-html-entity-decode.ts`) — importing it for its exported
// pure functions (as the test suite does) must not trigger a live DB scan.
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main()
    .catch(err => {
      console.error('[backfill-html-entity-decode] failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
