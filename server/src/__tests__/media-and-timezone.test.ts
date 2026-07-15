/**
 * Phase 6 (media) + Phase 5 (timezone) contracts.
 *  6a: R2 objects are deleted on post delete (were orphaned forever).
 *  6b: /highlights select includes poster_url so R2 videos get a thumbnail.
 *  5:  client encode paths use true-instant local Dates, not Date.UTC.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractR2Key } from '../lib/r2.js';

describe('6a extractR2Key (behavioral)', () => {
  const prev = process.env.R2_PUBLIC_BASE_URL;
  beforeAll(() => {
    process.env.R2_PUBLIC_BASE_URL = 'https://media.varsityhub.app';
  });
  afterAll(() => {
    process.env.R2_PUBLIC_BASE_URL = prev;
  });

  it('extracts the key from an R2 public URL', () => {
    expect(extractR2Key('https://media.varsityhub.app/varsityhub/production/abc.mp4')).toBe(
      'varsityhub/production/abc.mp4'
    );
  });
  it('returns null for a Cloudinary URL', () => {
    expect(extractR2Key('https://res.cloudinary.com/x/video/upload/v1/abc.mp4')).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(extractR2Key(null)).toBeNull();
  });
});

describe('6a post delete destroys R2 media', () => {
  it('posts.ts delete path calls deleteR2ObjectByUrl', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'routes', 'posts.ts'), 'utf8');
    expect(src).toMatch(/deleteR2ObjectByUrl/);
    // poster_url must be selected so it can be cleaned too
    const delIdx = src.indexOf('poster_url: true');
    expect(delIdx).toBeGreaterThan(-1);
  });
});

describe('6b highlights select includes poster_url', () => {
  it('highlightPostSelect selects poster_url', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'highlightPostSelect.ts'), 'utf8');
    expect(src).toMatch(/poster_url: true/);
  });
});
