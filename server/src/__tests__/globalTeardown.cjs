/**
 * Global test teardown - runs once after all tests complete
 * Closes database connections and cleans up resources
 */

module.exports = async function globalTeardown() {
  console.log('\n[Global Teardown] Cleaning up test resources...');
  
  // Import prisma dynamically to avoid module issues
  try {
    const { prisma } = await import('./prisma.js');
    await prisma.$disconnect();
    console.log('[Global Teardown] ✅ Prisma disconnected');
  } catch (error) {
    console.warn('[Global Teardown] ⚠️  Prisma cleanup skipped:', error.message);
  }
  
  // Small delay to allow cleanup
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log('[Global Teardown] ✅ Complete\n');
};
