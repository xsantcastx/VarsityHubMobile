#!/usr/bin/env tsx

process.env.NODE_ENV = 'test';
process.env.EMAIL_PROVIDER = 'test';

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';

const { app } = await import('../src/testApp.js');
const { prisma } = await import('../src/lib/prisma.js');

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(port, host, () => {
  console.log(`[verify-api] listening on http://${host}:${port}`);
});

async function shutdown(signal: string) {
  console.log(`[verify-api] shutting down on ${signal}`);
  server.close(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
