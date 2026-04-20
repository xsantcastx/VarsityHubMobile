module.exports = async () => {
  try {
    const mod = await import('../lib/prisma.js');
    await mod.prisma.$disconnect();
  } catch (_error) {
    // Ignore teardown cleanup errors; tests may not have loaded Prisma at all.
  }
};
