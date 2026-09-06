/**
 * Repair user-created competitive Event rows that never got a linked Game row.
 *
 * Correct contract:
 *   - Event.id = calendar/event page identity, RSVP, posting unlocks.
 *   - Game.id = competitive matchup identity, votes, scores, stories.
 *   - Competitive VarsityHub games have both, linked by Event.game_id.
 *   - Non-competitive events stay Event-only.
 *
 * Dry-run by default. Pass --apply to write.
 *
 *   npx tsx scripts/repair-orphan-competitive-events.ts
 *   npx tsx scripts/repair-orphan-competitive-events.ts --apply
 *
 * NOT wired into start.sh. Run manually against the target DB after reviewing
 * the dry-run output.
 */
import { prisma } from '../src/lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const BATCH = 100;

type OrphanCompetitiveEvent = {
  id: string;
  title: string;
  date: Date;
  timezone: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  banner_url: string | null;
  description: string | null;
  capacity: number | null;
  creator_id: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  approval_status: string;
  status: string;
  team_id: string | null;
};

function toGameApprovalStatus(eventApprovalStatus: string) {
  if (eventApprovalStatus === 'approved') return 'approved';
  if (eventApprovalStatus === 'rejected') return 'rejected';
  return 'pending';
}

async function findBatch(cursor?: string | null): Promise<OrphanCompetitiveEvent[]> {
  return prisma.event.findMany({
    where: {
      event_type: 'game',
      game_id: null,
      pro_home_team_id: null,
      pro_away_team_id: null,
    },
    select: {
      id: true,
      title: true,
      date: true,
      timezone: true,
      location: true,
      latitude: true,
      longitude: true,
      banner_url: true,
      description: true,
      capacity: true,
      creator_id: true,
      approved_by: true,
      approved_at: true,
      approval_status: true,
      status: true,
      team_id: true,
    },
    orderBy: { id: 'asc' },
    take: BATCH,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

async function main() {
  console.log(
    `\nOrphan competitive event repair - ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`
  );

  let cursor: string | null = null;
  let scanned = 0;
  let repaired = 0;

  for (;;) {
    const events = await findBatch(cursor);
    if (events.length === 0) break;
    cursor = events[events.length - 1].id;
    scanned += events.length;

    for (const event of events) {
      const approvalStatus = toGameApprovalStatus(event.approval_status);
      const location = event.location ?? 'TBD';
      console.log(
        `${APPLY ? 'repairing' : 'would repair'} event=${event.id} title="${event.title}" ` +
          `date=${event.date.toISOString()} team_id=${event.team_id ?? '(none)'}`
      );

      if (!APPLY) {
        repaired++;
        continue;
      }

      await prisma.$transaction(async tx => {
        const game = await tx.game.create({
          data: {
            title: event.title,
            date: event.date,
            timezone: event.timezone,
            location,
            latitude: event.latitude,
            longitude: event.longitude,
            venue_address: event.location,
            banner_url: event.banner_url,
            cover_image_url: event.banner_url,
            description: event.description,
            expected_attendance: event.capacity,
            event_type: 'game',
            approval_status: approvalStatus as any,
            created_by_id: event.creator_id,
            approved_by_id: event.approved_by,
            approved_at: event.approved_at,
            home_team_id: event.team_id,
          },
        });

        await tx.event.update({
          where: { id: event.id },
          data: { game_id: game.id },
        });
      });
      repaired++;
    }
  }

  console.log(`\nDone. scanned=${scanned}, ${APPLY ? 'repaired' : 'would_repair'}=${repaired}\n`);
}

main()
  .catch(err => {
    console.error('[repair-orphan-competitive-events] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
