/**
 * Create ONLY the Connecticut Cup one-off event (idempotent). Dry-run by
 * default; pass --apply to write. Scoped to this single event so it can't touch
 * the other entries in one-off-events.data.ts.
 *
 * A standalone baseball event at UConn, Storrs — NO team pages attached (a
 * teamless game so it surfaces on Discover, with the owner's flyer as banner).
 *
 *   npx tsx scripts/one-off/create-ct-cup.ts            # dry-run
 *   npx tsx scripts/one-off/create-ct-cup.ts --apply    # write
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const ADMIN_EMAIL = 'emancero@varsityhub.app';

const DEF = {
  title: 'The Connecticut Cup',
  description: 'The Connecticut Cup — baseball at UConn. Storrs, CT · July 30, 2026.',
  date: new Date('2026-07-30T16:00:00.000Z'), // 12:00 PM EDT (placeholder — no time on the flyer)
  location: 'J.O. Christian Field — UConn, Storrs, CT',
  lat: 41.8068,
  lng: -72.2512,
  bannerUrl: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1785267321/events/ct-cup-2026.png',
};

async function main() {
  console.log(APPLY ? '⚠️  APPLY mode — writing.\n' : 'Dry-run (no writes).\n');
  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  if (!admin) throw new Error(`Admin ${ADMIN_EMAIL} not found`);

  // Idempotent: match by title + exact date.
  let gameId: string | undefined;
  const existingGame = await prisma.game.findFirst({
    where: { title: DEF.title, date: DEF.date },
    select: { id: true },
  });
  if (existingGame) {
    gameId = existingGame.id;
    console.log(`ℹ️  Game already exists (${gameId})`);
  } else if (APPLY) {
    const g = await prisma.game.create({
      data: {
        title: DEF.title,
        description: DEF.description,
        date: DEF.date,
        location: DEF.location,
        latitude: DEF.lat,
        longitude: DEF.lng,
        venue_address: DEF.location,
        venue_lat: DEF.lat,
        venue_lng: DEF.lng,
        event_type: 'game',
        approval_status: 'approved',
        approved_at: new Date(),
        approved_by_id: admin.id,
        created_by_id: admin.id,
        is_neutral: true, // teamless — no home/away team cards
        banner_url: DEF.bannerUrl,
      },
      select: { id: true },
    });
    gameId = g.id;
    console.log(`✅ Game created (${gameId})`);
  } else {
    console.log('[dry-run] Would create teamless game');
  }

  const existingEvent = await prisma.event.findFirst({
    where: { title: DEF.title, date: DEF.date },
    select: { id: true },
  });
  if (existingEvent) {
    console.log(`ℹ️  Event already exists (${existingEvent.id})`);
  } else if (APPLY) {
    const e = await prisma.event.create({
      data: {
        title: DEF.title,
        description: DEF.description,
        date: DEF.date,
        location: DEF.location,
        latitude: DEF.lat,
        longitude: DEF.lng,
        event_type: 'game',
        game_id: gameId,
        creator_id: admin.id,
        creator_role: 'organizer',
        approval_status: 'approved',
        status: 'approved',
        approved_at: new Date(),
        approved_by: admin.id,
        contact_info: 'customerservice@varsityhub.app',
        linked_league: 'The Connecticut Cup',
        banner_url: DEF.bannerUrl,
      },
      select: { id: true },
    });
    console.log(`✅ Event created (${e.id})`);
  } else {
    console.log('[dry-run] Would create event linked to the game');
  }
  console.log(
    `\n${APPLY ? 'Done' : 'Dry-run complete'}: "${DEF.title}" @ ${DEF.location} on ${DEF.date.toISOString()}`
  );
}

main()
  .catch(e => {
    console.error('[create-ct-cup]', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
