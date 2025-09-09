import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'test@example.com';
  const password_hash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password_hash, display_name: 'Test User' },
  });

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

