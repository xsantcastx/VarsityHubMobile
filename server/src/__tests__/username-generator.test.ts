import { describe, it, expect } from '@jest/globals';
import { generateUniqueUsername, slugifyUsernameBase } from '../lib/usernameGenerator.js';
import { isReservedUsername } from '../lib/reservedUsernames.js';

// Minimal Prisma stand-in: a case-insensitive set of already-taken usernames.
function fakePrisma(existing: string[] = []) {
  const taken = new Set(existing.map(s => s.toLowerCase()));
  return {
    user: {
      findFirst: async ({ where }: any) => {
        const val = String(where.username.equals).toLowerCase();
        return taken.has(val) ? { id: 'x' } : null;
      },
    },
  };
}

const VALID = /^[a-z0-9_.]+$/;

describe('slugifyUsernameBase', () => {
  it('lowercases and strips to the allowed charset, keeping dots/underscores', () => {
    expect(slugifyUsernameBase('Emil Sanchez')).toBe('emilsanchez');
    expect(slugifyUsernameBase('n.y_yankees!!')).toBe('n.y_yankees');
    expect(slugifyUsernameBase('  ...__foo__...  ')).toBe('foo');
    expect(slugifyUsernameBase('')).toBe('');
  });
});

describe('generateUniqueUsername', () => {
  it('returns a valid handle from an email local-part', async () => {
    const u = await generateUniqueUsername('emil.sanchez', fakePrisma() as any);
    expect(u).toBe('emil.sanchez');
    expect(VALID.test(u)).toBe(true);
    expect(u.length).toBeGreaterThanOrEqual(3);
    expect(u.length).toBeLessThanOrEqual(20);
  });

  it('suffixes on a DB collision instead of reusing the taken handle', async () => {
    const u = await generateUniqueUsername('emil', fakePrisma(['emil']) as any);
    expect(u).not.toBe('emil');
    expect(u.startsWith('emil_')).toBe(true);
    expect(VALID.test(u)).toBe(true);
  });

  it('never returns a reserved username', async () => {
    const u = await generateUniqueUsername('admin', fakePrisma() as any);
    expect(isReservedUsername(u)).toBe(false);
  });

  it('respects extraTaken so a batch never proposes the same handle twice', async () => {
    const claimed = new Set<string>(['emil']);
    const u = await generateUniqueUsername('emil', fakePrisma() as any, claimed);
    expect(u).not.toBe('emil');
  });

  it('pads a too-short base up to the minimum length', async () => {
    const u = await generateUniqueUsername('a', fakePrisma() as any);
    expect(u.length).toBeGreaterThanOrEqual(3);
    expect(VALID.test(u)).toBe(true);
  });

  it('never exceeds 20 characters even for a long base', async () => {
    const u = await generateUniqueUsername('a'.repeat(50), fakePrisma(['a'.repeat(20)]) as any);
    expect(u.length).toBeLessThanOrEqual(20);
    expect(VALID.test(u)).toBe(true);
  });
});
