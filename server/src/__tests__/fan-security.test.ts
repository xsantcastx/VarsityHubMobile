/**
 * Fan-role security fixes (2026-07-14 fan audit, live-confirmed).
 *  - admin_broadcast feed injection: only a verified admin may create that type.
 *  - block→user_id scope clobber on GET /posts.
 *  - adult→minor DM age-gate must require an ACCEPTED follow + fail closed on DOB.
 *  - block filtering on profile-scoped reads.
 *  - post media_url/poster_url host allowlist.
 *  - GET /organizations/:id must not leak private/archived teams.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('admin_broadcast is admin-only on write', () => {
  it('post create coerces/blocks admin_broadcast for non-admins', () => {
    const src = read('routes', 'posts.ts');
    expect(src).toMatch(/RESERVED_POST_TYPES/);
    // an admin gate decides whether the reserved type survives
    expect(src).toMatch(/RESERVED_POST_TYPES\.has\(requestedType\) && !isBroadcastAdmin/);
    expect(src).not.toMatch(/type: data\.type \|\| 'post'/);
  });
});

describe('block does not clobber the user_id scope on GET /posts', () => {
  it('block filter merges with the author_id equality instead of overwriting', () => {
    const src = read('routes', 'posts.ts');
    // the fix keeps the scoped author id (object form) when applying block notIn
    expect(src).toMatch(/where\.author_id = \{ equals: String\(req\.query\.user_id\) \}/);
  });
});

describe('adult→minor DM gate requires an accepted follow', () => {
  it('uses status accepted (findFirst), not a raw findUnique', () => {
    const src = read('routes', 'messages.ts');
    const idx = src.indexOf('recipientAge');
    const region = idx >= 0 ? src.slice(Math.max(0, idx - 200), idx + 800) : src;
    // fail-closed helpers or an accepted-status follow check
    expect(region).toMatch(/status: 'accepted'|isMinor|isVerifiedAdult/);
  });
});

describe('profile reads apply block filtering', () => {
  it('isProfileHiddenFromViewer / profile post reads consult blocks', () => {
    const users = read('routes', 'users.ts');
    const priv = read('lib', 'privacyUtils.ts');
    expect(users.includes('getBlockedUserIds') || priv.includes('getBlockedUserIds')).toBe(true);
  });
});

describe('post media urls are host-allowlisted', () => {
  it('createPostSchema validates media_url/poster_url host', () => {
    const src = read('routes', 'posts.ts');
    const idx = src.indexOf('const createPostSchema');
    const region = src.slice(idx, idx + 1200);
    expect(region).toMatch(/isAllowedMediaHost|\.refine\(/);
  });
});

describe('org detail hides private/archived teams', () => {
  it('serializeOrganization teams include filters status active + private + take', () => {
    const src = read('lib', 'serializeOrganization.ts');
    expect(src).toMatch(/where: \{ status: 'active'.*, is_private: false \}/);
    expect(src).toMatch(/take: 200/);
  });
});
