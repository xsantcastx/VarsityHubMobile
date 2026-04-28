import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

import { resolveWellKnownDir } from '../routes/well-known.js';

const repoRoot = path.resolve(process.cwd(), '..');

describe('resolveWellKnownDir', () => {
  it('finds well-known files when the process cwd is the server directory', () => {
    expect(resolveWellKnownDir(process.cwd())).toBe(path.join(process.cwd(), 'well-known'));
  });

  it('finds well-known files when the process cwd is the repo root', () => {
    expect(resolveWellKnownDir(repoRoot)).toBe(path.join(repoRoot, 'server', 'well-known'));
  });
});
