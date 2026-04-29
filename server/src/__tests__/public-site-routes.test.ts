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
  it('serves a real landing page at root instead of Cannot GET /', async () => {
    const res = await request(buildApp()).get('/').set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toContain('text/html');
    expect(res.text).toContain('VarsityHub');
    expect(res.text).toContain('Support');
    expect(res.text).toContain('/privacy-policy');
    expect(res.text).not.toContain('Cannot GET /');
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
