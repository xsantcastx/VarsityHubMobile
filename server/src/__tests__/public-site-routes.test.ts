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

  it('serves a landing page on the www host instead of redirecting to itself', async () => {
    const res = await request(buildApp())
      .get('/')
      .set('Host', 'www.varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('VarsityHub');
    expect(res.text).toContain('Support');
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

  it('redirects browser app entry routes to the configured web app host', async () => {
    const res = await request(buildApp())
      .get('/sign-in?next=%2Fcreate-team')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(307);
    expect(res.headers.location).toBe(
      'https://varsity-hub-varsityhub.expo.app/sign-in?next=%2Fcreate-team'
    );
  });

  it('redirects organization browser routes to the configured web app host', async () => {
    const res = await request(buildApp())
      .get('/organizations/test-org')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(307);
    expect(res.headers.location).toBe('https://varsity-hub-varsityhub.expo.app/organizations/test-org');
  });
});
