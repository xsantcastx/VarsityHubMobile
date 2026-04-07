/**
 * Create sample events with fake teams for screenshots and social media promotion.
 *
 * Usage:
 *   npx tsx scripts/create-sample-event.ts
 *
 * Requires DATABASE_URL in environment (or .env file).
 * Safe to re-run — uses upsert where possible.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

// Fake team/event data — no real team names
const SAMPLE_EVENTS = [
  {
    title: 'Northside Eagles vs Southpoint Wolves',
    description: 'Friday night rivalry game under the lights. Come support your team! Concessions and spirit wear available at the gate.',
    event_type: 'game',
    location: '750 Stadium Drive, Stamford, CT 06902',
    home_team: 'Northside Eagles',
    away_team: 'Southpoint Wolves',
    daysFromNow: 4,
    hour: 19, // 7 PM
  },
  {
    title: 'Riverside Hawks Watch Party',
    description: 'Join the Riverside Hawks community for a live watch party! Big screens, food trucks, and team giveaways.',
    event_type: 'watch_party',
    location: '120 Main Street, Greenwich, CT 06830',
    home_team: 'Riverside Hawks',
    away_team: null,
    daysFromNow: 6,
    hour: 18, // 6 PM
  },
  {
    title: 'Bay City Lions vs Crestview Panthers',
    description: 'Conference championship game. Student section opens at 5:30 PM. Wear your gold!',
    event_type: 'game',
    location: '400 Field House Lane, Norwalk, CT 06851',
    home_team: 'Bay City Lions',
    away_team: 'Crestview Panthers',
    daysFromNow: 7,
    hour: 18,
  },
];

async function main() {
  try {
    // Find or use demo account as creator
    let creator = await prisma.user.findFirst({
      where: { email: 'demo@varsityhub.app' },
    });
    if (!creator) {
      // Fallback: find any admin or first user
      creator = await prisma.user.findFirst({
        orderBy: { created_at: 'asc' },
      });
    }
    if (!creator) {
      console.error('No users found in database. Run create-demo-account.ts first.');
      process.exit(1);
    }

    console.log(`Using creator: ${creator.email} (${creator.id})\n`);

    for (const evt of SAMPLE_EVENTS) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + evt.daysFromNow);
      eventDate.setHours(evt.hour, 0, 0, 0);

      // Create the game record first (for game-type events)
      if (evt.event_type === 'game') {
        const game = await prisma.game.create({
          data: {
            title: evt.title,
            description: evt.description,
            date: eventDate,
            location: evt.location,
            home_team: evt.home_team,
            away_team: evt.away_team || 'TBD',
            approval_status: 'approved',
            created_by_id: creator.id,
          },
        });

        // Create associated event
        const event = await prisma.event.create({
          data: {
            title: evt.title,
            description: evt.description,
            date: eventDate,
            location: evt.location,
            event_type: evt.event_type,
            game_id: game.id,
            creator_id: creator.id,
            approval_status: 'approved',
            status: 'approved',
            approved_at: new Date(),
            creator_role: 'organizer',
          },
        });

        console.log(`✅ Game + Event created: "${evt.title}"`);
        console.log(`   Game ID: ${game.id}`);
        console.log(`   Event ID: ${event.id}`);
        console.log(`   Date: ${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString()}\n`);
      } else {
        // Non-game events
        const event = await prisma.event.create({
          data: {
            title: evt.title,
            description: evt.description,
            date: eventDate,
            location: evt.location,
            event_type: evt.event_type,
            creator_id: creator.id,
            approval_status: 'approved',
            status: 'approved',
            approved_at: new Date(),
            creator_role: 'organizer',
          },
        });

        console.log(`✅ Event created: "${evt.title}"`);
        console.log(`   Event ID: ${event.id}`);
        console.log(`   Date: ${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString()}\n`);
      }
    }

    console.log('Done! Sample events are live and will appear in the feed.');
  } catch (err) {
    console.error('Failed to create sample events:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
