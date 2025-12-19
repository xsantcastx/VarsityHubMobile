/**
 * Global test teardown - runs once after all tests complete
 * Closes database connections and cleans up resources
 */

module.exports = async function globalTeardown() {
  console.log('\n[Global Teardown] Cleaning up test resources...');
  
  // Import PrismaClient directly to avoid module resolution issues
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$disconnect();
    console.log('[Global Teardown] ✅ Prisma disconnected');
  } catch (error) {
    console.warn('[Global Teardown] ⚠️  Prisma cleanup skipped:', error.message);
  }
  
  // Small delay to allow cleanup
  await new Promise(resolve => setTimeout(resolve, 300));
  
  console.log('[Global Teardown] ✅ Complete\n');
};
