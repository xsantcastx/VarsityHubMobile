import { describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const gameFind = jest.fn(async () => []);
jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: { game: { findMany: gameFind }, event: { findMany: jest.fn(async () => []) } },
}));
const { eventDiscoveryRouter } = await import('../routes/eventDiscovery.js');
const app = express();
app.use('/event-discovery', eventDiscoveryRouter);

describe('discovery HTTP contract', () => {
  it('serves an explicit completed page through the real router and discovery service', async () => {
    const response = await request(app).get(
      '/event-discovery?surface=map&paginated=true&sport=football&level=college'
    );
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.next_cursor).toBeNull();
    expect(gameFind).toHaveBeenCalled();
  });
  it.each([
    'sport=not-a-real-sport',
    'level=ncaa',
    'paginated=true&cursor=forged',
    'from=2026-09-12&to=2026-09-01',
  ])('rejects inaccurate or invalid filters: %s', async query => {
    const response = await request(app).get(`/event-discovery?${query}`);
    expect(response.status).toBe(400);
  });
});
