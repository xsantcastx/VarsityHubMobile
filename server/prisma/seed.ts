import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'test@example.com';
  const password_hash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email },
    update: { email_verified: true },
    create: { email, password_hash, display_name: 'Test User', email_verified: true },
  });

  const email2 = 'other@example.com';
  const email3 = 'jamie@example.com';
  const password_hash2 = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({ where: { email: email2 }, update: { email_verified: true }, create: { email: email2, password_hash: password_hash2, display_name: 'Other User', email_verified: true } });
  await prisma.user.upsert({ where: { email: email3 }, update: { email_verified: true }, create: { email: email3, password_hash: password_hash2, display_name: 'Jamie Fox', email_verified: true } });

  // Seed games
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + (i + 1) * 2);
    await prisma.game.create({
      data: {
        title: `Game ${i + 1}`,
        date,
        location: ['Gym A', 'Stadium B', 'Field C'][i % 3],
        description: 'Friendly match',
        cover_image_url: i % 2 === 0 ? `https://picsum.photos/seed/game${i}/800/400` : null,
      },
    });
  }

  // Seed posts
  for (let i = 0; i < 10; i++) {
    await prisma.post.create({
      data: {
        title: `Post ${i + 1}`,
        content: `Sample content ${i + 1}`,
        type: i % 2 ? 'update' : 'post',
        media_url: null,
        upvotes_count: Math.floor(Math.random() * 10),
      },
    });
  }

  // Seed stories for the first game
  const firstGame = await prisma.game.findFirst({});
  const user1 = await prisma.user.findUnique({ where: { email } });
  if (firstGame && user1) {
    await prisma.story.create({ data: { game_id: firstGame.id, user_id: user1.id, media_url: 'https://picsum.photos/seed/story1/640/360', caption: 'Warmups' } });
  }

  // Seed events
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + (i + 1));
    await prisma.event.create({
      data: {
        title: `Event ${i + 1}`,
        date,
        location: 'Main Hall',
        status: 'approved',
        capacity: 50 + i * 5,
      },
    });
  }

  // Seed messages
  for (let i = 0; i < 8; i++) {
    await prisma.message.create({
      data: {
        conversation_id: 'general',
        sender_email: i % 2 ? 'test@example.com' : 'other@example.com',
        recipient_email: i % 2 ? 'other@example.com' : 'test@example.com',
        content: `Hello ${i}!`,
        read: i % 3 === 0,
      },
    });
  }

  // Seed an Ad and reservations
  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner) {
    const ad = await prisma.ad.create({
      data: {
        user_id: owner.id,
        contact_name: 'Test User',
        contact_email: email,
        business_name: 'Acme Pizza',
        banner_url: 'https://picsum.photos/seed/banner1/728/90',
        target_zip_code: '12345',
        radius: 45,
        description: 'Best slices in town',
        status: 'draft',
        payment_status: 'unpaid',
      },
    });
    const today = new Date();
    const iso = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const d1 = new Date(today); d1.setDate(today.getDate() + 2);
    const d2 = new Date(today); d2.setDate(today.getDate() + 5);
    await prisma.adReservation.createMany({
      data: [iso(d1), iso(d2)].map((d) => ({ ad_id: ad.id, date: d })),
      skipDuplicates: true,
    });
  }

  // Seed teams
  const t1 = await prisma.team.create({ data: { name: 'Springfield Eagles', description: 'Varsity team focusing on excellence and sportsmanship.' } });
  const t2 = await prisma.team.create({ data: { name: 'Riverside Tigers', description: 'Competitive and spirited.' } });
  const u1 = await prisma.user.findUnique({ where: { email } });
  const u2 = await prisma.user.findUnique({ where: { email: email2 } });
  const u3 = await prisma.user.findUnique({ where: { email: email3 } });
  if (u1 && u2 && u3) {
    await prisma.teamMembership.create({ data: { team_id: t1.id, user_id: u1.id, role: 'owner' } });
    await prisma.teamMembership.create({ data: { team_id: t1.id, user_id: u3.id, role: 'manager' } });
    await prisma.teamMembership.create({ data: { team_id: t2.id, user_id: u2.id, role: 'coach' } as any });
    await prisma.teamInvite.create({ data: { team_id: t2.id, email: 'jamie@example.com', role: 'member' } });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed complete');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
