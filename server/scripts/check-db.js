/*
 Quick connectivity check for the configured Prisma database.
 Usage:
   DATABASE_URL="postgresql://..." node scripts/check-db.js
*/

const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected. SELECT 1 ok.');
  } catch (err) {
    console.error('❌ Database check failed:', err.message || err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
