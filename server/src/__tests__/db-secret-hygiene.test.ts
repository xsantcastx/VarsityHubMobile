import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), '..');

const files = [
  'server/docs/POSTGRESQL_GUIDE.md',
  'docs/DATABASE_SETUP.md',
  'docs/SECURITY_INCIDENT_RESPONSE.md',
  'server/test-database.ps1',
  'server/scripts/e2e/README.md',
  'server/scripts/e2e/test-coach-application-flow.sh',
  'server/scripts/e2e/test-single-session.sh',
  'server/scripts/e2e/test-integration-crossmatrix.sh',
  'server/scripts/verify-beta-data.js',
  'docs/archive/IMPLEMENTATION_ROADMAP.md',
];

const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('database secret hygiene', () => {
  it('does not commit Railway public proxy hosts into audited docs/scripts', () => {
    for (const file of files) {
      expect(read(file)).not.toMatch(/\.proxy\.rlwy\.net/);
    }
  });

  it('does not commit live-looking postgres credentials into audited docs/scripts', () => {
    const unsafeCredentialPattern =
      /postgresql:\/\/[^:\s]+:(?!\*{3}|PASSWORD|password|<[^>]+>|\[REDACTED)[^@\s]+@/i;

    for (const file of files) {
      expect(read(file)).not.toMatch(unsafeCredentialPattern);
    }
  });

  it('does not normalize DATABASE_PUBLIC_URL as the routine production path', () => {
    for (const file of files) {
      expect(read(file)).not.toMatch(/DATABASE_PUBLIC_URL/);
    }
  });
});
