import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const serverSrcDir = path.resolve(process.cwd(), 'src');

function walkTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath);
    }
  }

  return files;
}

describe('Sentry import hygiene', () => {
  it('routes server-side Sentry usage through lib/sentry.ts', () => {
    const offenders = walkTsFiles(serverSrcDir)
      .filter(filePath => !filePath.endsWith(path.join('lib', 'sentry.ts')))
      .filter(filePath => !filePath.includes(`${path.sep}__tests__${path.sep}`))
      .filter(filePath => fs.readFileSync(filePath, 'utf8').includes("from '@sentry/node'"))
      .map(filePath => path.relative(serverSrcDir, filePath));

    expect(offenders).toEqual([]);
  });
});
