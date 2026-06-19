/**
 * Route-integrity test (covers every Expo Router route file under app/).
 *
 * Expo Router auto-registers every file under app/ as a route. A route that
 * fails to default-export a component renders a blank screen; a bridge
 * re-export whose target was moved/renamed throws at navigation time. Neither
 * is caught by the TypeScript build (a missing default export is a runtime
 * concern) so this static sweep is the guardrail.
 *
 * Pure `node:fs` — no React Native imports — so it stays fast and stable and
 * never depends on native module mocking.
 */
import { describe, expect, it } from '@jest/globals';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const APP_DIR = join(process.cwd(), 'app');

/** Recursively collect every .tsx file under app/, skipping test folders. */
function collectRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      collectRouteFiles(full, acc);
    } else if (entry.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

const DEFAULT_EXPORT_RE = /export\s+default\b/;
const DEFAULT_BRIDGE_RE = /export\s+\{\s*default(\s+as\s+default)?\s*\}\s+from\s+['"]([^'"]+)['"]/;
const STAR_BRIDGE_RE = /export\s+\*\s+from\s+['"]([^'"]+)['"]/;

const routeFiles = collectRouteFiles(APP_DIR);

/** Resolve a relative import specifier to a real source file, trying extensions. */
function resolveModule(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

describe('Expo Router route integrity', () => {
  it('finds a non-trivial number of route files (sanity guard)', () => {
    expect(routeFiles.length).toBeGreaterThan(100);
  });

  it('every route file default-exports a component or re-exports one', () => {
    const offenders: string[] = [];
    for (const file of routeFiles) {
      const src = readFileSync(file, 'utf8');
      const hasDefault =
        DEFAULT_EXPORT_RE.test(src) || DEFAULT_BRIDGE_RE.test(src) || STAR_BRIDGE_RE.test(src);
      if (!hasDefault) offenders.push(file.replace(`${process.cwd()}/`, ''));
    }
    expect(offenders).toEqual([]);
  });

  it('every bridge re-export resolves to a real source file', () => {
    const broken: string[] = [];
    for (const file of routeFiles) {
      const src = readFileSync(file, 'utf8');
      for (const re of [DEFAULT_BRIDGE_RE, STAR_BRIDGE_RE]) {
        const match = src.match(re);
        if (!match) continue;
        const spec = match[match.length - 1];
        if (!spec.startsWith('.')) continue; // package import, not a local bridge
        if (!resolveModule(file, spec)) {
          broken.push(`${file.replace(`${process.cwd()}/`, '')} -> ${spec}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
