import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

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
  
  // Sports content categories
  const sportsContent = [
    { title: 'INSANE Basketball Dunk! 🏀', content: 'Just witnessed the most incredible slam dunk at tonight\'s game. Player cleared the defender by 3 feet!', media: 'https://picsum.photos/seed/dunk1/640/360', upvotes: 45 },
    { title: 'TOUCHDOWN! Game Winner! 🏈', content: 'Last second touchdown pass wins the championship! What a throw under pressure!', media: 'https://picsum.photos/seed/football1/640/360', upvotes: 78 },
    { title: 'Soccer Goal from Half Field! ⚽', content: 'Unbelievable goal scored from the center line. Keeper had no chance!', media: 'https://picsum.photos/seed/soccer1/640/360', upvotes: 32 },
    { title: 'Triple Play Baseball Highlight ⚾', content: 'Rare triple play executed perfectly! Runner caught stealing, double play at second and first.', media: 'https://picsum.photos/seed/baseball1/640/360', upvotes: 28 },
    { title: 'Hockey Hat Trick! 🏒', content: 'Three goals in the third period to complete the comeback win!', media: 'https://picsum.photos/seed/hockey1/640/360', upvotes: 41 },
    { title: 'Tennis Match Point Winner 🎾', content: 'Championship point won with an ace down the line. What a serve!', media: 'https://picsum.photos/seed/tennis1/640/360', upvotes: 19 },
    { title: 'Volleyball Spike Compilation 🏐', content: 'Best spikes from this weekend\'s tournament. The power is unreal!', media: 'https://picsum.photos/seed/volleyball1/640/360', upvotes: 25 },
    { title: 'Swimming Record Broken! 🏊‍♂️', content: 'New school record in the 100m freestyle! Sub-50 seconds for the first time!', upvotes: 33 },
    { title: 'Track & Field Long Jump 🏃‍♀️', content: 'Personal best jump of 6.2 meters! Regional qualification secured!', media: 'https://picsum.photos/seed/track1/640/360', upvotes: 29 },
    { title: 'Wrestling Pin in 30 Seconds! 🤼‍♂️', content: 'Fastest pin of the season! Technical takedown to immediate pin.', media: 'https://picsum.photos/seed/wrestling1/640/360', upvotes: 37 },
    { title: 'Cross Country Victory! 🏃‍♂️', content: 'Team takes first place in the regional championship. All runners in top 15!', upvotes: 22 },
    { title: 'Gymnastics Perfect 10! 🤸‍♀️', content: 'Flawless floor routine earns a perfect score! State championship here we come!', media: 'https://picsum.photos/seed/gymnastics1/640/360', upvotes: 44 },
    { title: 'Golf Hole-in-One! ⛳', content: 'Ace on the 16th hole! 150-yard shot with a 7-iron straight into the cup!', upvotes: 31 },
    { title: 'Lacrosse Goal of the Year! 🥍', content: 'Behind-the-back shot while falling down. Pure skill and luck combined!', media: 'https://picsum.photos/seed/lacrosse1/640/360', upvotes: 26 },
    { title: 'Cheerleading Pyramid! 📣', content: 'Three-tier pyramid executed flawlessly at halftime. Great team spirit!', media: 'https://picsum.photos/seed/cheer1/640/360', upvotes: 18 },
    { title: 'Debate Team Wins State! 🎤', content: 'Our debate team takes the state championship! Incredible arguments and rebuttals.', upvotes: 15 },
    { title: 'Quiz Bowl Victory! 🧠', content: 'Academic team wins the regional quiz bowl. Final question was about physics!', upvotes: 14 },
    { title: 'Band Halftime Show! 🎺', content: 'Marching band delivers amazing halftime performance. Standing ovation!', media: 'https://picsum.photos/seed/band1/640/360', upvotes: 27 },
    { title: 'Drama Club Performance! 🎭', content: 'Spring musical was absolutely fantastic! Sold out all three nights.', upvotes: 21 },
    { title: 'Science Fair Winner! 🔬', content: 'Chemistry project on renewable energy wins first place at regionals!', upvotes: 16 }
  ];

  for (let i = 0; i < sportsContent.length; i++) {
    const content = sportsContent[i];
    const authorId = [u1.id, u2.id, u3.id][i % 3];
    
    // Create posts with varied creation times for better trending
    const createdAt = new Date();
    createdAt.setHours(createdAt.getHours() - Math.random() * 72); // Within last 3 days
    
    const post = await prisma.post.create({
      data: {
        title: content.title,
        content: content.content,
        type: content.media ? 'highlight' : 'update',
        media_url: content.media || null,
        upvotes_count: content.upvotes,
        author_id: authorId,
        game_id: i < gameIds.length ? gameIds[i % gameIds.length] : null,
        country_code: 'US',
        lat: 40.7128 + (Math.random() - 0.5) * 0.1, // NYC area with variation
        lng: -74.0060 + (Math.random() - 0.5) * 0.1,
        created_at: createdAt,
      },
    });
    postsCreated.push(post);
  }
  
  // Add some comments to popular posts
  const topPosts = postsCreated.filter(p => p.id).slice(0, 5);
  for (const post of topPosts) {
    for (let j = 0; j < Math.floor(Math.random() * 8) + 2; j++) {
      await prisma.comment.create({
        data: {
          content: [
            'Amazing play!', 'Incredible skill!', 'Best I\'ve ever seen!', 
            'How did they do that?', 'Unreal!', 'Championship material!',
            'This deserves more views!', 'Sharing this everywhere!',
            'Coach must be proud!', 'Natural talent right there!'
          ][j % 10],
          post_id: post.id,
          author_id: [u1.id, u2.id, u3.id][j % 3],
        }
      });
    }
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

  // --- Promo Codes ---
  await prisma.promoCode.upsert({
    where: { code: 'FREE100' },
    update: {},
    create: { code: 'FREE100', type: 'COMPLIMENTARY', enabled: true, max_redemptions: 100 },
  });
  await prisma.promoCode.upsert({
    where: { code: 'SAVE25' },
    update: {},
    create: {
      code: 'SAVE25', type: 'PERCENT_OFF', percent_off: 25, enabled: true,
      start_at: new Date(), end_at: new Date(Date.now() + 30*24*3600*1000),
      max_redemptions: 500, per_user_limit: 1,
    },
  });

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


