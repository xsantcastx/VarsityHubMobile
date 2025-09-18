import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // --- Users ---
  const password_hash = await bcrypt.hash('password123', 10);

  const u1 = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: { email_verified: true, display_name: 'Test User' },
    create: { email: 'test@example.com', password_hash, display_name: 'Test User', email_verified: true },
  });

  const u2 = await prisma.user.upsert({
    where: { email: 'other@example.com' },
    update: { email_verified: true, display_name: 'Other User' },
    create: { email: 'other@example.com', password_hash, display_name: 'Other User', email_verified: true },
  });

  const u3 = await prisma.user.upsert({
    where: { email: 'jamie@example.com' },
    update: { email_verified: true, display_name: 'Jamie Fox' },
    create: { email: 'jamie@example.com', password_hash, display_name: 'Jamie Fox', email_verified: true },
  });

  // --- Games ---
  const gameIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + (i + 1) * 2);
    const g = await prisma.game.create({
      data: {
        title: `Game ${i + 1}`,
        date,
        location: ['Gym A', 'Stadium B', 'Field C'][i % 3],
        description: 'Friendly match',
        cover_image_url: i % 2 === 0 ? `https://picsum.photos/seed/game${i}/800/400` : null,
      },
    });
    gameIds.push(g.id);
  }

  // --- Posts (now require author) ---
  const postsCreated: Array<{ id: string; created_at: Date }> = [];
  for (let i = 0; i < 10; i++) {
    const post = await prisma.post.create({
      data: {
        title: `Post ${i + 1}`,
        content: `Sample content ${i + 1}`,
        type: i % 2 ? 'update' : 'post',
        media_url: null,
        upvotes_count: Math.floor(Math.random() * 10),

        // REQUIRED: link to an author
        author_id: i % 2 === 0 ? u1.id : u2.id,

        // Optional: link some posts to games
        game_id: gameIds[i % gameIds.length],
      },
    });
    postsCreated.push(post);
  }

  // --- Categories and plays ---
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: 'dunks' }, update: { name: 'Dunks', icon_url: 'https://picsum.photos/seed/dunks/200/200' }, create: { name: 'Dunks', slug: 'dunks', icon_url: 'https://picsum.photos/seed/dunks/200/200' } }),
    prisma.category.upsert({ where: { slug: 'breaking-ankles' }, update: { name: 'Breaking Ankles', icon_url: 'https://picsum.photos/seed/crossovers/200/200' }, create: { name: 'Breaking Ankles', slug: 'breaking-ankles', icon_url: 'https://picsum.photos/seed/crossovers/200/200' } }),
    prisma.category.upsert({ where: { slug: 'game-winners' }, update: { name: 'Game Winners', icon_url: 'https://picsum.photos/seed/winner/200/200' }, create: { name: 'Game Winners', slug: 'game-winners', icon_url: 'https://picsum.photos/seed/winner/200/200' } }),
    prisma.category.upsert({ where: { slug: 'defensive-gems' }, update: { name: 'Defensive Gems', icon_url: 'https://picsum.photos/seed/defense/200/200' }, create: { name: 'Defensive Gems', slug: 'defensive-gems', icon_url: 'https://picsum.photos/seed/defense/200/200' } }),
  ]);

  const categoryAssignments: Array<{ category_id: string; post_id: string }> = [];
  for (let i = 0; i < postsCreated.length; i++) {
    const post = postsCreated[i];
    const category = categories[i % categories.length];
    categoryAssignments.push({ category_id: category.id, post_id: post.id });
    if ((i + 1) % 3 === 0) {
      const secondary = categories[(i + 1) % categories.length];
      categoryAssignments.push({ category_id: secondary.id, post_id: post.id });
    }
  }
  if (categoryAssignments.length) {
    await prisma.categoryAssignment.createMany({ data: categoryAssignments, skipDuplicates: true });
  }
  if (categories.length) {
    await prisma.categoryFollow.createMany({
      data: categories.slice(0, Math.min(2, categories.length)).map((category) => ({ user_id: u1.id, category_id: category.id })),
      skipDuplicates: true,
    });
  }

  // --- Story for first game ---
  if (gameIds.length > 0) {
    await prisma.story.create({
      data: {
        game_id: gameIds[0],
        user_id: u1.id,
        media_url: 'https://picsum.photos/seed/story1/640/360',
        caption: 'Warmups',
      },
    });
  }

  // --- Events ---
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + (i + 1));
    const relatedGameId = i < Math.min(3, gameIds.length) ? gameIds[i] : null;
    await prisma.event.create({
      data: {
        title: `Event ${i + 1}`,
        date,
        location: 'Main Hall',
        banner_url: `https://picsum.photos/seed/event${i}/800/400`,
        status: 'approved', // your schema allows any string; default is "draft"
        capacity: 50 + i * 5,
        game_id: relatedGameId,
      },
    });
  }

  // --- Messages (use sender_id / recipient_id; no `read` field) ---
  for (let i = 0; i < 8; i++) {
    const sender = i % 2 ? u1 : u2;
    const recipient = i % 2 ? u2 : u1;
    await prisma.message.create({
      data: {
        conversation_id: 'general',
        sender_id: sender.id,
        recipient_id: recipient.id,
        content: `Hello ${i}!`,
      },
    });
  }

  // --- Ad & reservations ---
  const ad = await prisma.ad.create({
    data: {
      user_id: u1.id,
      contact_name: 'Test User',
      contact_email: 'test@example.com',
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
  const isoDate = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const d1 = new Date(today); d1.setDate(today.getDate() + 2);
  const d2 = new Date(today); d2.setDate(today.getDate() + 5);
  await prisma.adReservation.createMany({
    data: [isoDate(d1), isoDate(d2)].map((d) => ({ ad_id: ad.id, date: d })),
    skipDuplicates: true,
  });

  // --- Teams & memberships ---
  const t1 = await prisma.team.create({ data: { name: 'Springfield Eagles', description: 'Varsity team focusing on excellence and sportsmanship.' } });
  const t2 = await prisma.team.create({ data: { name: 'Riverside Tigers', description: 'Competitive and spirited.' } });

  await prisma.teamMembership.create({ data: { team_id: t1.id, user_id: u1.id, role: 'owner' } });
  await prisma.teamMembership.create({ data: { team_id: t1.id, user_id: u3.id, role: 'manager' } });
  await prisma.teamMembership.create({ data: { team_id: t2.id, user_id: u2.id, role: 'coach' } as any });
  await prisma.teamInvite.create({ data: { team_id: t2.id, email: 'jamie@example.com', role: 'member' } });

  console.log('Seed complete');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


