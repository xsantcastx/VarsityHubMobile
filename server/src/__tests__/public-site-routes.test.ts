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

  it('redirects the www host to the apex domain', async () => {
    const res = await request(buildApp())
      .get('/')
      .set('Host', 'www.varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://varsityhub.app/');
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

      expect(root.status).toBe(307);
      expect(root.headers.location).toBe('/feed');

      const signIn = await request(buildApp())
        .get('/sign-in')
        .set('Host', 'varsityhub.app')
        .set('Accept', 'text/html');

      expect(signIn.status).toBe(200);
      expect(signIn.text).toContain('sign in web app');

      const wwwRoot = await request(buildApp())
        .get('/')
        .set('Host', 'www.varsityhub.app')
        .set('Accept', 'text/html');

      expect(wwwRoot.status).toBe(308);
      expect(wwwRoot.headers.location).toBe('https://varsityhub.app/');
    } finally {
      process.env.WEB_DIST_DIR = previous;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('serves the legal, support, and account deletion pages from the shared public router', async () => {
    const app = buildApp();

    const [privacy, terms, support, accountDeletion] = await Promise.all([
      request(app).get('/privacy-policy').set('Accept', 'text/html'),
      request(app).get('/terms').set('Accept', 'text/html'),
      request(app).get('/support').set('Accept', 'text/html'),
      request(app).get('/account-deletion').set('Accept', 'text/html'),
    ]);

    expect(privacy.status).toBe(200);
    expect(privacy.text).toContain('Privacy Policy');
    expect(terms.status).toBe(200);
    expect(terms.text).toContain('Terms of Service');
    expect(support.status).toBe(200);
    expect(support.text).toContain('Customer Service');
    expect(accountDeletion.status).toBe(200);
    expect(accountDeletion.text).toContain('Account Deletion');
  });

  it('serves the landing page for app entry routes on apex when no web bundle is deployed', async () => {
    const res = await request(buildApp())
      .get('/sign-in?next=%2Fcreate-team')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('VarsityHub');
  });

  it('serves the landing page for organization routes on apex when no web bundle is deployed', async () => {
    const res = await request(buildApp())
      .get('/organizations/test-org')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('VarsityHub');
  });
});
