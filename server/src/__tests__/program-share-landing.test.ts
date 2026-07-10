/**
 * Program share-landing regression suite.
 *
 * Mirrors server/src/__tests__/share-landing.test.ts for the new
 * GET /programs/:id universal-link web fallback:
 *   1. JSON clients fall through to the (stub) API route unchanged.
 *   2. Browser/crawler requests get an HTML landing with OG tags.
 *   3. The title is "{Org name} — {Program label}" when the program has
 *      an org and no explicit `name` override; falls back to the
 *      explicit `name` when set.
 *   4. Unknown program id 404s (falls through to next(), which the stub
 *      API answers with a JSON-style 404 here).
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const sportProgramFindUnique = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    post: { findUnique: jest.fn() },
    game: { findUnique: jest.fn() },
    team: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    sportProgram: { findUnique: sportProgramFindUnique },
  },
}));

const { shareLandingRouter } = await import('../routes/shareLanding.js');

function makeApp() {
  const app = express();
  app.use(shareLandingRouter);
  app.get('/programs/:id', (_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}

describe('program share-landing', () => {
  beforeEach(() => {
    sportProgramFindUnique.mockReset();
  });

  it('JSON client (Accept: application/json) falls through to API', async () => {
    const res = await request(makeApp()).get('/programs/p1').set('Accept', 'application/json');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(sportProgramFindUnique).not.toHaveBeenCalled();
  });

  it('Browser request (Accept: text/html) gets HTML landing with org + program label', async () => {
    sportProgramFindUnique.mockResolvedValueOnce({
      sport: 'basketball',
      gender: 'girls',
      name: null,
      logo_url: 'https://cdn.example.com/program-logo.jpg',
      organization: { name: 'Stamford High' },
    } as any);

    const res = await request(makeApp()).get('/programs/p1').set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('og:title');
    expect(res.text).toContain('Stamford High — Girls Basketball');
    expect(res.text).toContain('https://cdn.example.com/program-logo.jpg');
    expect(sportProgramFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1' } }));
  });

  it('uses the explicit name override when set, still prefixed by org name', async () => {
    sportProgramFindUnique.mockResolvedValueOnce({
      sport: 'basketball',
      gender: 'girls',
      name: 'Lady Knights Basketball',
      logo_url: null,
      organization: { name: 'Stamford High' },
    } as any);

    const res = await request(makeApp()).get('/programs/p2').set('Accept', 'text/html');

    expect(res.text).toContain('Stamford High — Lady Knights Basketball');
  });

  it('coed programs omit the gender word in the label', async () => {
    sportProgramFindUnique.mockResolvedValueOnce({
      sport: 'track_field',
      gender: 'coed',
      name: null,
      logo_url: null,
      organization: { name: 'Westhill' },
    } as any);

    const res = await request(makeApp()).get('/programs/p3').set('Accept', 'text/html');

    expect(res.text).toContain('Westhill — Track Field');
    expect(res.text).not.toContain('Coed Track Field');
  });

  it('falls back to the label with no org prefix when the program has no organization', async () => {
    sportProgramFindUnique.mockResolvedValueOnce({
      sport: 'soccer',
      gender: 'boys',
      name: null,
      logo_url: null,
      organization: null,
    } as any);

    const res = await request(makeApp()).get('/programs/p4').set('Accept', 'text/html');

    expect(res.text).toContain('Boys Soccer');
    expect(res.text).not.toContain('undefined');
    expect(res.text).not.toContain('null');
  });

  it('unknown program id falls through to next() (API 404)', async () => {
    sportProgramFindUnique.mockResolvedValueOnce(null as any);

    const res = await request(makeApp()).get('/programs/missing').set('Accept', 'text/html');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('escapes HTML entities in the program label (no XSS)', async () => {
    sportProgramFindUnique.mockResolvedValueOnce({
      sport: 'basketball',
      gender: 'girls',
      name: '<script>alert(1)</script>',
      logo_url: null,
      organization: { name: 'Stamford High' },
    } as any);

    const res = await request(makeApp()).get('/programs/p5').set('Accept', 'text/html');

    expect(res.text).not.toContain('<script>alert');
    expect(res.text).toContain('&lt;script&gt;');
  });
});
