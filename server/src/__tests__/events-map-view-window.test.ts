/**
 * GET /events?map_view=true — server-authoritative map window.
 *
 * The national map fetches events across the whole country, so the server (not
 * just the client) must bound them to the rolling now → +14d window that games
 * already use. This pins that: an event just inside the window is returned; one
 * beyond it, and a past one, are not — regardless of what the caller asks for.
 *
 * Regression guard for the "further than two weeks" bug, which shipped because
 * the window was enforced for games but not events.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;

const DAY = 24 * 60 * 60 * 1000;
const TAG = `mapwin-${Date.now()}`;

describe('GET /events?map_view=true window', () => {
  const ids: string[] = [];
  const title = (k: string) => `${TAG}-${k}`;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    const now = Date.now();
    const mk = async (k: string, offsetMs: number) => {
      const e = await prisma.event.create({
        data: {
          title: title(k),
          date: new Date(now + offsetMs),
          status: 'approved',
          approval_status: 'approved',
          latitude: 40.7128,
          longitude: -74.006,
        },
      });
      ids.push(e.id);
    };
    await mk('inside', 13 * DAY); // just inside the 14-day window
    await mk('beyond', 20 * DAY); // past +14d — must be excluded
    await mk('past', -2 * DAY); // already happened — must be excluded
  });

  afterAll(async () => {
    if (ids.length) await prisma.event.deleteMany({ where: { id: { in: ids } } });
  });

  it('returns only events inside now → +14d, dropping far-future and past ones', async () => {
    const res = await request(app).get('/events?map_view=true&limit=300').expect(200);
    const titles = new Set((res.body as any[]).map(e => e.title));
    expect(titles.has(title('inside'))).toBe(true);
    expect(titles.has(title('beyond'))).toBe(false);
    expect(titles.has(title('past'))).toBe(false);
  });

  it('cannot be widened past the window even if the caller sends a far `to`', async () => {
    const far = new Date(Date.now() + 90 * DAY).toISOString();
    const res = await request(app)
      .get(`/events?map_view=true&to=${encodeURIComponent(far)}&limit=300`)
      .expect(200);
    const titles = new Set((res.body as any[]).map(e => e.title));
    expect(titles.has(title('beyond'))).toBe(false);
  });
});
