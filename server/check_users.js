const { PrismaClient } = require('@prisma/client');
require('./src/lib/load-env.js');

const prisma = new PrismaClient();

async function main() {
  const appleUsers = await prisma.user.findMany({
    where: { apple_id: { not: null } },
    select: {
      id: true,
      email: true,
      display_name: true,
      apple_id: true,
      google_id: true,
      email_verified: true,
      created_at: true,
      preferences: true
    },
    orderBy: { created_at: 'desc' },
    take: 3
  });
  
  console.log('\n📱 Apple Sign-In users:');
  appleUsers.forEach(u => {
    console.log(`\nUser: ${u.display_name} (${u.email})`);
    console.log(`  ID: ${u.id}`);
    console.log(`  Apple ID: ${u.apple_id}`);
    console.log(`  Email Verified: ${u.email_verified}`);
    console.log(`  Onboarding Complete: ${u.preferences?.onboarding_completed}`);
    console.log(`  Role: ${u.preferences?.role}`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
