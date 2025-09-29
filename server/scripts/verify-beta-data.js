#!/usr/bin/env node

// Quick script to verify Railway database content
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showBetaTestData() {
  console.log('🏆 VarsityHub Beta Testing Setup Complete!');
  console.log('=' .repeat(50));
  console.log();

  // Check users
  const users = await prisma.user.findMany({
    where: { email: { in: ['coach@test.com', 'player@test.com', 'fan@test.com'] } },
    select: { display_name: true, email: true, username: true }
  });
  
  console.log('👥 Test Accounts:');
  users.forEach(user => {
    console.log(`  ✅ ${user.display_name} (@${user.username}) - ${user.email}`);
  });
  console.log('     Password for all accounts: beta123');
  console.log();

  // Check posts
  const posts = await prisma.post.findMany({
    include: {
      author: { select: { display_name: true } },
      _count: { select: { comments: true, upvotes: true } }
    }
  });
  
  console.log('📱 Sample Posts:');
  posts.forEach(post => {
    console.log(`  🏈 "${post.title}" by ${post.author.display_name}`);
    console.log(`     ${post._count.comments} comments, ${post._count.upvotes} upvotes`);
  });
  console.log();

  // Check follows
  const follows = await prisma.follows.count();
  console.log(`🤝 Follow relationships: ${follows}`);
  
  console.log();
  console.log('🚀 Ready for Beta Testing!');
  console.log('   Railway Database: postgresql://postgres:***@hopper.proxy.rlwy.net:22104/railway');
  console.log('   Frontend: Start your Expo app and test with these accounts');
  console.log('   Backend: Your API is ready to serve data to beta testers');
  console.log();
}

showBetaTestData()
  .then(() => process.exit(0))
  .catch(console.error)
  .finally(() => prisma.$disconnect());