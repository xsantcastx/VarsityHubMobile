import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Immutable historical migrations: append new migrations, do not rewrite or
// delete applied history. Baseline recovered against production checksums.
const baseline: Record<string, string> = JSON.parse(
  readFileSync(resolve('prisma/migration-checksums.json'), 'utf8')
);
it('preserves every baselined migration file and exact checksum', () => {
  const changed: string[] = [];
  for (const [name, expected] of Object.entries(baseline)) {
    try {
      const sql = readFileSync(resolve('prisma/migrations', name, 'migration.sql'));
      if (createHash('sha256').update(sql).digest('hex') !== expected) changed.push(name);
    } catch {
      changed.push(name);
    }
  }
  expect(changed).toEqual([]);
});
