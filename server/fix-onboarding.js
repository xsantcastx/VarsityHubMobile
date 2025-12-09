import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fixing onboarding_completed flag for all existing users...');
    
    const result = await prisma.user.updateMany({
      data: {
        preferences: {
          onboarding_completed: true
        }
      }
    });
    
    console.log(`✅ Updated ${result.count} users`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
