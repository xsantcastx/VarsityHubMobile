/**
 * Fast root path — health monitors hammer `/` on the API host, and it used to
 * fall through the whole auth + API-router chain before the redirect at the
 * very end (~750ms server-side). It is now short-circuited early in app.ts with
 * the SAME behavior (308 → marketing site). This pins that redirect so the
 * early handler can never silently diverge from publicSiteRouter's API-host
 * behavior. (Web hosts still fall through to serve the web app — not asserted
 * here because the web-host allowlist depends on runtime env.)
 */
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

describe('fast root path (API host)', () => {
  it('GET / 308-redirects to the marketing site', async () => {
    const res = await request(app).get('/').redirects(0);
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://varsityhub.app/');
  });

  it('HEAD / 308-redirects to the marketing site', async () => {
    const res = await request(app).head('/').redirects(0);
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://varsityhub.app/');
  });
});
