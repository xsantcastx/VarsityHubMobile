// Quick Railway Database Health Check
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseHealth() {
  console.log('🔍 Checking Railway database connection...');
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@'));
  
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users in database`);
    
    await prisma.$disconnect();
    console.log('✅ Database is healthy and responsive');
    process.exit(0);
  } catch (error) {
    console.log('❌ Database connection failed:');
    console.log(error.message);
    console.log('\n💡 Possible solutions:');
    console.log('   1. Restart Railway Postgres service');
    console.log('   2. Check Railway service status');
    console.log('   3. Verify DATABASE_URL in Railway variables');
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkDatabaseHealth();