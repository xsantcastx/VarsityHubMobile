import { jest } from '@jest/globals';

describe('prisma bootstrap production compatibility', () => {
  const priorEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...priorEnv };
    jest.resetModules();
  });

  it('does not crash on a standard Railway DATABASE_URL without pool params', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@postgres-tngr.railway.internal:5432/railway';

    await expect(import('../lib/prisma.js')).resolves.toBeDefined();
  });
});
