module.exports = async () => {
  try {
    const prisma = globalThis.__VARSITYHUB_TEST_PRISMA__;
    if (prisma?.$disconnect) {
      await prisma.$disconnect();
    }
  } catch (_error) {
    // Ignore teardown cleanup errors; tests may not have loaded Prisma at all.
  }
};
