import { describe, expect, it } from '@jest/globals';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    expect(res.headers.location).toBe('https://varsityhub.app/');
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

  it('serves the exported web app when a web dist directory is available', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-public-site-'));
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<!doctype html><html><body>real web app</body></html>');
    fs.writeFileSync(path.join(tempDir, 'sign-in.html'), '<!doctype html><html><body>sign in web app</body></html>');

    const previous = process.env.WEB_DIST_DIR;
    process.env.WEB_DIST_DIR = tempDir;

    try {
      const root = await request(buildApp())
        .get('/')
        .set('Host', 'varsityhub.app')
        .set('Accept', 'text/html');

      expect(root.status).toBe(200);
      expect(root.text).toContain('real web app');

      const signIn = await request(buildApp())
        .get('/sign-in')
        .set('Host', 'www.varsityhub.app')
        .set('Accept', 'text/html');

      expect(signIn.status).toBe(200);
      expect(signIn.text).toContain('sign in web app');
    } finally {
      process.env.WEB_DIST_DIR = previous;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

  it('serves the fallback landing page for browser app entry routes when no web bundle is deployed', async () => {
    const res = await request(buildApp())
      .get('/sign-in?next=%2Fcreate-team')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('VarsityHub');
    expect(res.text).toContain('web app bundle is not available');
  });

  it('serves the fallback landing page for organization routes when no web bundle is deployed', async () => {
    const res = await request(buildApp())
      .get('/organizations/test-org')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('VarsityHub');
    expect(res.text).toContain('web app bundle is not available');
  });
});
