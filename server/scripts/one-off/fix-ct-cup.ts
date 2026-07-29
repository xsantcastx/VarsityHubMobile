/**
 * Fix the CT Cup: (1) remove the matchup poll — it's a teamless one-off, not a
 * "who wins" game, so switch event_type game→other (the poll gate only fires on
 * 'game'); (2) set a 12-hour geofenced posting window 7am→7pm EDT. The window
 * opens event.date−1h and closes event.date+live_window_hours_after_start, so a
 * 8am EDT start (12:00 UTC) + 11h gives 7am→7pm. Dry-run unless --apply.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const NEW_DATE = new Date('2026-07-30T12:00:00.000Z'); // 8:00 AM EDT
const WINDOW_HOURS = 11; // 8am + 11h = 7pm; open = 8am − 1h = 7am → 12h window

async function main() {
  console.log(APPLY ? '⚠️  APPLY\n' : 'Dry-run\n');
  const g = await prisma.game.findFirst({
    where: { title: 'The Connecticut Cup' },
    select: { id: true, event_type: true, date: true },
  });
  const e = await prisma.event.findFirst({
    where: { title: 'The Connecticut Cup' },
    select: { id: true, event_type: true, date: true, live_window_hours_after_start: true },
  });
  console.log('BEFORE game:', JSON.stringify(g));
  console.log('BEFORE event:', JSON.stringify(e));
  if (APPLY) {
    if (g)
      await prisma.game.update({
        where: { id: g.id },
        data: { event_type: 'other', date: NEW_DATE },
      });
    if (e)
      await prisma.event.update({
        where: { id: e.id },
        data: { event_type: 'other', date: NEW_DATE, live_window_hours_after_start: WINDOW_HOURS },
      });
    const g2 = await prisma.game.findFirst({
      where: { title: 'The Connecticut Cup' },
      select: { event_type: true, date: true },
    });
    const e2 = await prisma.event.findFirst({
      where: { title: 'The Connecticut Cup' },
      select: { event_type: true, date: true, live_window_hours_after_start: true },
    });
    console.log('\nAFTER game:', JSON.stringify(g2));
    console.log('AFTER event:', JSON.stringify(e2));
    const openUTC = new Date(NEW_DATE.getTime() - 3600e3),
      closeUTC = new Date(NEW_DATE.getTime() + WINDOW_HOURS * 3600e3);
    console.log(
      `\nPosting window: ${openUTC.toISOString()} → ${closeUTC.toISOString()} (7:00 AM → 7:00 PM EDT, 12h). Poll: OFF (event_type=other).`
    );
  } else {
    console.log(
      '\n[dry-run] Would set event_type=other (poll off) + date 12:00Z + live_window_hours_after_start=11 (7am→7pm).'
    );
  }
}
main()
  .catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
