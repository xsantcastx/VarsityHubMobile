#!/usr/bin/env npx tsx
/**
 * Verifies DB-backed test suites use the shared dbTestGuard helper.
 *
 * This prevents drift where individual test files reintroduce inline
 * SKIP_SERVER_DB_TESTS / CI gating logic instead of importing describeDb.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const TEST_ROOT = path.join(process.cwd(), 'src', '__tests__');
const HELPER_IMPORT_RE = /import\s+\{\s*describeDb\s*\}\s+from\s+['"]\.\/dbTestGuard\.js['"];?/;
const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'inline SKIP_SERVER_DB_TESTS logic', re: /\bSKIP_SERVER_DB_TESTS\b/ },
  { label: 'inline CI gating logic', re: /process\.env\.CI/ },
  { label: 'local describeDb declaration', re: /const\s+describeDb\s*=/ },
];

async function listTestFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTestFiles(full)));
      continue;
    }

    if (entry.isFile() && /\.(test|spec)\.ts$/.test(entry.name)) {
      files.push(full);
    }
  }

  return files;
}

async function main() {
  const testFiles = await listTestFiles(TEST_ROOT);
  const failures: string[] = [];

  for (const file of testFiles) {
    const rel = path.relative(process.cwd(), file);
    const source = await fs.readFile(file, 'utf8');

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.re.test(source)) {
        failures.push(`${rel}: ${rule.label}`);
      }
    }

    if (/\bdescribeDb\s*\(/.test(source) && !HELPER_IMPORT_RE.test(source)) {
      failures.push(`${rel}: describeDb used without importing ./dbTestGuard.js`);
    }
  }

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('DB test guard verification failed:');
    for (const failure of failures) {
      // eslint-disable-next-line no-console
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`dbTestGuard verification passed for ${testFiles.length} test files.`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('verify-db-test-guard failed:', error);
  process.exit(1);
});
