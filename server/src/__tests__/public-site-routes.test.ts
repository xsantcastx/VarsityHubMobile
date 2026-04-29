import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { publicSiteRouter } from '../routes/publicSite.js';

function buildApp() {
  const app = express();
  app.use(publicSiteRouter);
  return app;
}

describe('Public site routes', () => {
  it('redirects the bare root to the dedicated marketing site', async () => {
    const res = await request(buildApp()).get('/').set('Accept', 'text/html');

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://www.varsityhub.app/');
  });

  it('serves the legal and support pages from the shared public router', async () => {
    const app = buildApp();

    const [privacy, terms, support] = await Promise.all([
      request(app).get('/privacy-policy').set('Accept', 'text/html'),
      request(app).get('/terms').set('Accept', 'text/html'),
      request(app).get('/support').set('Accept', 'text/html'),
    ]);

    expect(privacy.status).toBe(200);
    expect(privacy.text).toContain('Privacy Policy');
    expect(terms.status).toBe(200);
    expect(terms.text).toContain('Terms of Service');
    expect(support.status).toBe(200);
    expect(support.text).toContain('Customer Service');
  });
});
