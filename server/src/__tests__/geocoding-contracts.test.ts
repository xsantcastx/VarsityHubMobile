import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

describe('Geocoding contracts', () => {
  let prisma: any;
  let signJwt: any;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const user = await prisma.user.create({
      data: {
        email: `test-geocoding-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Geocoding Contract User',
        email_verified: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });

    userId = user.id;
    token = signJwt({ id: user.id });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  });

  it('honors the autocomplete limit query param at the server contract boundary', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        status: 'OK',
        predictions: Array.from({ length: 8 }, (_, index) => ({
          description: `Suggestion ${index + 1}`,
          place_id: `place-${index + 1}`,
          structured_formatting: { main_text: `Suggestion ${index + 1}` },
        })),
      },
    } as any);

    const res = await request(app)
      .get('/geocoding/autocomplete?input=albany&limit=3')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions).toHaveLength(3);
    expect(res.body.suggestions.map((item: any) => item.place_id)).toEqual([
      'place-1',
      'place-2',
      'place-3',
    ]);
  });

  it('rate limits repeated geocoding lookups with a route-specific 429', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            geometry: { location: { lat: 42.6526, lng: -73.7562 } },
            formatted_address: 'Albany, NY, USA',
          },
        ],
      },
    } as any);

    for (let index = 0; index < 10; index += 1) {
      await request(app)
        .post('/geocoding/location')
        .set('Authorization', `Bearer ${token}`)
        .send({ location: `Albany ${index}` })
        .expect(200);
    }

    const blocked = await request(app)
      .post('/geocoding/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ location: 'Albany blocked' })
      .expect(429);

    expect(blocked.body).toMatchObject({
      error: 'Too many requests',
      message: 'Please slow down and try again later',
    });
  });
});
