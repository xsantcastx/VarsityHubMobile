/**
 * Open Graph link-preview pages (2026-07-06): varsityhub.app is a static
 * Expo web export (one index.html for every route), so it can never serve
 * per-event og:image/og:title. Vercel rewrites crawler UAs for /events/:id
 * and /games/:id to these server-rendered routes instead. Public and
 * unauthenticated by design — but must reveal ONLY data GET /games and
 * GET /events already treat as public (approved).
 */
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
const ts = Date.now();

describe('Open Graph link-preview pages', () => {
  let approvedGameId = '';
  let pendingGameId = '';
  let approvedEventId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));

    const approvedGame = await prisma.game.create({
      data: {
        title: `OG Approved Game <script>alert(1)</script> ${ts}`,
        date: new Date(),
        location: 'Test Stadium',
        banner_url: 'https://res.cloudinary.com/demo/image/upload/og-banner.jpg',
        approval_status: 'approved',
      },
    });
    approvedGameId = approvedGame.id;

    const pendingGame = await prisma.game.create({
      data: {
        title: `OG Pending Game Secret Title ${ts}`,
        date: new Date(),
        location: 'Hidden Location',
        approval_status: 'pending',
      },
    });
    pendingGameId = pendingGame.id;

    const approvedEvent = await prisma.event.create({
      data: {
        title: `OG Approved Event ${ts}`,
        date: new Date(),
        location: 'Test Venue',
        status: 'approved',
        approval_status: 'approved',
        creator_role: 'coach',
      },
    });
    approvedEventId = approvedEvent.id;
  });

  afterAll(async () => {
    try {
      await prisma.event.deleteMany({ where: { id: approvedEventId } }).catch(() => {});
      await prisma.game
        .deleteMany({ where: { id: { in: [approvedGameId, pendingGameId] } } })
        .catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  it('escapes HTML in the game title (no script injection)', async () => {
    const res = await request(app).get(`/og/games/${approvedGameId}`);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });

  it('an approved game includes og:title and og:image', async () => {
    const res = await request(app).get(`/og/games/${approvedGameId}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/og:title/);
    expect(res.text).toContain('og-banner.jpg');
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('a non-approved (pending) game yields the generic page — no title or location leak', async () => {
    const res = await request(app).get(`/og/games/${pendingGameId}`);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('OG Pending Game Secret Title');
    expect(res.text).not.toContain('Hidden Location');
    expect(res.text).toContain('VarsityHub');
  });

  it('a nonexistent game id yields the generic page, not a 404 or 500', async () => {
    const res = await request(app).get('/og/games/does-not-exist-12345');
    expect(res.status).toBe(200);
    expect(res.text).toContain('VarsityHub');
  });

  it('requires no authentication', async () => {
    const res = await request(app).get(`/og/games/${approvedGameId}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('an approved event includes og:title', async () => {
    const res = await request(app).get(`/og/events/${approvedEventId}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/og:title/);
    expect(res.text).toContain('OG Approved Event');
  });
});
