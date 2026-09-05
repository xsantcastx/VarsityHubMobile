/** Runs the production app outside Jest's experimental ESM module registry. */
const destination = new URL(process.env.DATABASE_URL || '');
if (
  process.env.NODE_ENV !== 'test' ||
  !['127.0.0.1', 'localhost'].includes(destination.hostname) ||
  !/^\/varsityhub_(?:audit_|test)/.test(destination.pathname) ||
  !process.send
) {
  throw new Error('Full-app test server requires IPC and a dedicated loopback test database');
}

const { app } = await import('../../app.js');
const { prisma } = await import('../../lib/prisma.js');
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  process.send?.({ type: 'ready', baseUrl: `http://127.0.0.1:${address.port}` });
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void stop());
process.on('disconnect', () => void stop());
