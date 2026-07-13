/**
 * Route push notification awaits — structural regression guard.
 *
 * Request handlers must not await `sendPushNotification(...)` in normal app
 * routes. Push delivery is best-effort and should never add latency to the
 * primary response path. The explicit test route is excluded because it exists
 * to exercise push sending directly.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes');
const EXCLUDED_FILES = new Set(['test-notifications.ts']);

type Finding = {
  file: string;
  line: number;
  snippet: string;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules' || name === 'dist') continue;
      walk(p, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && !EXCLUDED_FILES.has(name)) {
      out.push(p);
    }
  }
  return out;
}

function analyze(filePath: string): Finding[] {
  const content = readFileSync(filePath, 'utf8');
  const findings: Finding[] = [];
  const pattern = /await\s+sendPushNotification\s*\(/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const before = content.slice(0, match.index);
    const line = before.split('\n').length;
    const snippet = content.slice(match.index, Math.min(match.index + 220, content.length));
    findings.push({
      file: relative(process.cwd(), filePath),
      line,
      snippet,
    });
  }

  return findings;
}

describe('Route push notifications are non-blocking', () => {
  it('does not await sendPushNotification in app route handlers', () => {
    const files = walk(ROUTES_DIR);
    const findings = files.flatMap(analyze);

    if (findings.length > 0) {
      const formatted = findings
        .map(f => `  ${f.file}:${f.line}\n    ${f.snippet.replace(/\n/g, '\n    ')}`)
        .join('\n\n');
      throw new Error(
        `Found ${findings.length} awaited route-level sendPushNotification call(s). Use fire-and-forget with .catch(...) instead.\n\n${formatted}`
      );
    }

    expect(findings).toEqual([]);
  });
});
