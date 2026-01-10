// Fix failed migration in Railway database
// This script marks the failed migration as rolled back so it can be re-applied

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFailedMigration() {
  try {
    console.log('🔧 Fixing failed migration...');
    
    // Delete the failed migration entry
    await prisma.$executeRawUnsafe(`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name = 'add_severity_to_reports';
    `);
    
    console.log('✅ Failed migration entry removed');
    console.log('The migration will be re-applied on next deploy');
    
  } catch (error) {
    console.error('❌ Error fixing migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixFailedMigration();
