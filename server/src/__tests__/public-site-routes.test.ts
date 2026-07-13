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

  it('redirects the apex host to the canonical www web host', async () => {
    const res = await request(buildApp())
      .get('/')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://www.varsityhub.app/');
  });

  it('serves the exported web app when a web dist directory is available', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-public-site-'));
    fs.writeFileSync(
      path.join(tempDir, 'index.html'),
      '<!doctype html><html><body>real web app</body></html>'
    );
    fs.writeFileSync(
      path.join(tempDir, 'sign-in.html'),
      '<!doctype html><html><body>sign in web app</body></html>'
    );

    const previous = process.env.WEB_DIST_DIR;
    process.env.WEB_DIST_DIR = tempDir;

    try {
      const root = await request(buildApp())
        .get('/')
        .set('Host', 'varsityhub.app')
        .set('Accept', 'text/html');

      expect(root.status).toBe(308);
      expect(root.headers.location).toBe('https://www.varsityhub.app/');

      const signIn = await request(buildApp())
        .get('/sign-in')
        .set('Host', 'varsityhub.app')
        .set('Accept', 'text/html');

      expect(signIn.status).toBe(308);
      expect(signIn.headers.location).toBe('https://www.varsityhub.app/sign-in');

      const wwwRoot = await request(buildApp())
        .get('/')
        .set('Host', 'www.varsityhub.app')
        .set('Accept', 'text/html');

      expect(wwwRoot.status).toBe(307);
      expect(wwwRoot.headers.location).toBe('/feed');
    } finally {
      process.env.WEB_DIST_DIR = previous;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('serves the privacy, support, and account deletion pages from the shared public router', async () => {
    const app = buildApp();

    const [privacy, support, accountDeletion] = await Promise.all([
      request(app).get('/privacy-policy').set('Accept', 'text/html'),
      request(app).get('/support').set('Accept', 'text/html'),
      request(app).get('/account-deletion').set('Accept', 'text/html'),
    ]);

    expect(privacy.status).toBe(200);
    expect(privacy.text).toContain('Privacy Policy');
    expect(support.status).toBe(200);
    expect(support.text).toContain('Customer Service');
    expect(accountDeletion.status).toBe(200);
    expect(accountDeletion.text).toContain('Account Deletion');
  });

  it('redirects app entry routes on apex to the canonical www web host', async () => {
    const res = await request(buildApp())
      .get('/sign-in?next=%2Fcreate-team')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://www.varsityhub.app/sign-in?next=%2Fcreate-team');
  });

  it('redirects organization routes on apex to the canonical www web host', async () => {
    const res = await request(buildApp())
      .get('/organizations/test-org')
      .set('Host', 'varsityhub.app')
      .set('Accept', 'text/html');

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://www.varsityhub.app/organizations/test-org');
  });
});
