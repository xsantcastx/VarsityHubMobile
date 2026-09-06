/**
 * Media host allowlist — single source of truth (2026-07-16 Fanatics Fest).
 *
 * Six inline copies of this allowlist used to live across auth/posts/games/
 * teams/organizations. Only the posts.ts copy learned about R2 when the media
 * migration went live (2026-07-13), so every other surface started 400ing on
 * the R2 URLs the uploader had already begun returning. Live-confirmed at the
 * fest: PUT /auth/me with an R2 avatar_url returned
 *   {"error":"Invalid payload","issues":[{"path":["avatar_url"], ...}]}
 * which surfaced in-app as "Partial Save — Invalid payload" and meant profile
 * pictures could not be set at all.
 *
 * These tests pin both the behavior and the no-drift rule.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isAllowedAssetUrl,
  isAllowedAvatarUrl,
  isAllowedMediaUrl,
  isAllowedPostMediaUrl,
} from '../lib/mediaHosts.js';

const R2_BASE = 'https://pub-61f12b49067c403ca5f56fa57105b3ed.r2.dev';
const R2_AVATAR = `${R2_BASE}/uploads/abc123.jpg`;
const CLOUDINARY_AVATAR = 'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1/abc123.jpg';

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('R2-hosted media is accepted once R2_PUBLIC_BASE_URL is set', () => {
  const prior = process.env.R2_PUBLIC_BASE_URL;
  beforeEach(() => {
    process.env.R2_PUBLIC_BASE_URL = R2_BASE;
  });
  afterEach(() => {
    if (prior === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = prior;
  });

  it('accepts an R2 avatar (the fest repro)', () => {
    expect(isAllowedAvatarUrl(R2_AVATAR)).toBe(true);
  });

  it('accepts R2 for media and plain assets (stories, logos, banners)', () => {
    expect(isAllowedMediaUrl(R2_AVATAR)).toBe(true);
    expect(isAllowedAssetUrl(R2_AVATAR)).toBe(true);
    expect(isAllowedPostMediaUrl(R2_AVATAR)).toBe(true);
  });

  it('still accepts the Cloudinary hosts it always did', () => {
    expect(isAllowedAvatarUrl(CLOUDINARY_AVATAR)).toBe(true);
    expect(isAllowedMediaUrl(CLOUDINARY_AVATAR)).toBe(true);
  });

  it('reads the env at call time, so a deploy that sets it needs no rebuild', () => {
    delete process.env.R2_PUBLIC_BASE_URL;
    expect(isAllowedAvatarUrl(R2_AVATAR)).toBe(false);
    process.env.R2_PUBLIC_BASE_URL = R2_BASE;
    expect(isAllowedAvatarUrl(R2_AVATAR)).toBe(true);
  });

  it('ignores a malformed R2 base instead of throwing', () => {
    process.env.R2_PUBLIC_BASE_URL = 'not-a-url';
    expect(() => isAllowedAvatarUrl(R2_AVATAR)).not.toThrow();
    expect(isAllowedAvatarUrl(R2_AVATAR)).toBe(false);
    expect(isAllowedAvatarUrl(CLOUDINARY_AVATAR)).toBe(true);
  });
});

describe('off-platform and lookalike hosts stay rejected', () => {
  it('rejects an arbitrary host (moderation bypass + IP-tracking vector)', () => {
    expect(isAllowedAvatarUrl('https://evil.example.com/a.jpg')).toBe(false);
    expect(isAllowedMediaUrl('https://evil.example.com/a.jpg')).toBe(false);
  });

  // Regression: the old inline copies used `hostname.endsWith(d)`, so an
  // attacker-registered lookalike passed the check.
  it('rejects a suffix-lookalike domain', () => {
    expect(isAllowedAvatarUrl('https://evil-varsityhub.app/a.jpg')).toBe(false);
    expect(isAllowedMediaUrl('https://notres.cloudinary.com.evil.com/a.jpg')).toBe(false);
  });

  it('accepts a true subdomain of an allowed host', () => {
    expect(isAllowedMediaUrl('https://foo.cdn.varsityhub.app/a.jpg')).toBe(true);
  });

  it('rejects non-https and protocol-relative URLs', () => {
    expect(isAllowedAvatarUrl('http://res.cloudinary.com/a.jpg')).toBe(false);
    expect(isAllowedMediaUrl('//res.cloudinary.com/a.jpg')).toBe(false);
    expect(isAllowedPostMediaUrl('http://res.cloudinary.com/dxb5oq4fs/image/upload/a.jpg')).toBe(
      false
    );
    expect(isAllowedPostMediaUrl('//res.cloudinary.com/dxb5oq4fs/image/upload/a.jpg')).toBe(false);
  });
});

describe('avatar vs media semantics stay distinct', () => {
  it('allows OAuth provider CDNs for avatars only', () => {
    const google = 'https://lh3.googleusercontent.com/a/default-user';
    expect(isAllowedAvatarUrl(google)).toBe(true);
    // A post/logo must never point at an OAuth CDN.
    expect(isAllowedMediaUrl(google)).toBe(false);
    expect(isAllowedAssetUrl(google)).toBe(false);
  });

  it('allows data: URIs and relative paths for media, not for bare assets', () => {
    expect(isAllowedMediaUrl('data:image/png;base64,iVBORw0KG')).toBe(true);
    expect(isAllowedMediaUrl('/uploads/local.jpg')).toBe(true);
    expect(isAllowedAssetUrl('data:image/png;base64,iVBORw0KG')).toBe(false);
    expect(isAllowedAssetUrl('/uploads/local.jpg')).toBe(false);
    expect(isAllowedPostMediaUrl('data:image/png;base64,iVBORw0KG')).toBe(false);
    expect(isAllowedPostMediaUrl('/uploads/local.jpg')).toBe(false);
  });

  it('requires post media to be the configured Cloudinary account', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'dxb5oq4fs';
    expect(
      isAllowedPostMediaUrl('https://res.cloudinary.com/dxb5oq4fs/image/upload/v1/abc123.jpg')
    ).toBe(true);
    expect(
      isAllowedPostMediaUrl('https://res.cloudinary.com/other-cloud/image/upload/v1/abc123.jpg')
    ).toBe(false);
  });
});

describe('no route re-declares the allowlist inline', () => {
  // The whole bug was six copies drifting apart. Any new inline copy is the
  // same bug waiting to happen, so fail the build instead of trusting review.
  const routeFiles = [
    'routes/auth.ts',
    'routes/posts.ts',
    'routes/games.ts',
    'routes/teams.ts',
    'routes/organizations.ts',
  ];

  it.each(routeFiles)('%s defers to lib/mediaHosts', file => {
    const src = read(...file.split('/'));
    expect(src).not.toMatch(/'res\.cloudinary\.com'\s*,\s*\n?\s*'varsityhub\.app'/);
    expect(src).toMatch(/from '\.\.\/lib\/mediaHosts\.js'/);
  });
});
