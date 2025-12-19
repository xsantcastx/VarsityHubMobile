/**
 * Global test teardown - runs once after all tests complete
 */
module.exports = async function globalTeardown() {
  console.log('\n[Global Teardown] Cleaning up test resources...');
  try {
    const { prisma } = await import('./prisma.js');
    await prisma.$disconnect();
    console.log('[Global Teardown] ✅ Prisma disconnected');
  } catch (error) {
    console.warn('[Global Teardown] ⚠️  Prisma cleanup skipped:', error?.message || error);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  console.log('[Global Teardown] ✅ Complete\n');
};
