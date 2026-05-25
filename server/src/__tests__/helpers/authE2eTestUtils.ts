import { describeDb } from './dbTestSuite.js';

export { describeDb };

export const PASSWORD = 'TestPassword123!';

export function adultDob(years = 25): Date {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}

export async function loadAuthE2eDeps() {
  const [{ prisma }, { signJwt }, supertestModule, { app }] = await Promise.all([
    import('../../lib/prisma.js'),
    import('../../lib/jwt.js'),
    import('supertest'),
    import('../../authTestApp.js'),
  ]);

  return {
    prisma,
    signJwt,
    request: supertestModule.default,
    app,
  };
}
