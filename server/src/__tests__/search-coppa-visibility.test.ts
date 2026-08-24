import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

describe('Search — COPPA minor visibility', () => {
  let searcherToken: string;
  const userIds: string[] = [];

  async function makeUser(prefix: string, dob: Date | null, onboardingComplete: boolean) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${ts}-${Math.random()}@example.com`,
        password_hash: hash,
        display_name: prefix,
        username: `${prefix}${String(ts).slice(-8)}`.slice(0, 20),
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: dob,
        onboarding_completed: onboardingComplete,
        preferences: { onboarding_completed: onboardingComplete, role: 'fan' },
      },
    });
    userIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const searcher = await makeUser('coppasearcher', yearsAgo(30), true);
    searcherToken = signJwt({ id: searcher.id });

    await makeUser('coppaadult', yearsAgo(25), true);
    await makeUser('coppaminor', yearsAgo(15), true);
    await makeUser('coppanulldob', null, false);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('shows a verified adult in search', async () => {
    const res = await request(app)
      .get(`/search?q=coppaadult${String(ts).slice(-8)}`)
      .set('Authorization', `Bearer ${searcherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users?.length).toBeGreaterThan(0);
  });

  it('hides a 13-17 minor from search', async () => {
    const res = await request(app)
      .get(`/search?q=coppaminor${String(ts).slice(-8)}`)
      .set('Authorization', `Bearer ${searcherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users ?? []).toEqual([]);
  });

  it('hides a null-DOB (incomplete onboarding) account from search', async () => {
    const res = await request(app)
      .get(`/search?q=coppanulldob${String(ts).slice(-8)}`)
      .set('Authorization', `Bearer ${searcherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users ?? []).toEqual([]);
  });
});
