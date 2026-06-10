/**
 * navigation-tab-registry.test.ts
 *
 * Structural invariants for the (tabs) navigator.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The app uses a dual-file pattern: sub-screens live in both
 * `app/(tabs)/SCREEN.tsx` (for tab-bar context) and `app/SCREEN.tsx`
 * (re-export, for root Stack history). Every (tabs) sub-screen that is NOT
 * a visible tab must appear in `hiddenTabScreenNames` in (tabs)/_layout.tsx.
 *
 * If a screen is missing from that list, Expo Router renders it as a visible
 * tab with no icon — a phantom tab that appears in the tab bar.
 *
 * ROOT CAUSE HISTORY
 * ──────────────────
 * Prior to commit 5f63d59e (Mar 2026), all sub-screens were flat Tabs.Screen
 * entries with href:null and had no stack history — every back action jumped
 * to the feed tab. This test guards against re-introducing that pattern and
 * ensures new screens are properly registered.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROOT = process.cwd();

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function listTabsScreenFiles(): string[] {
  const dir = join(ROOT, 'app', '(tabs)');
  const results: string[] = [];

  function walk(current: string, prefix: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, rel);
      } else if (
        entry.isFile() &&
        /\.(tsx|ts)$/.test(entry.name) &&
        !entry.name.startsWith('_') &&
        !/\.test\.(tsx|ts)$/.test(entry.name) &&
        !/\.web\.(tsx|ts)$/.test(entry.name)
      ) {
        results.push(rel.replace(/\.(tsx|ts)$/, ''));
      }
    }
  }

  walk(dir, '');
  return results;
}

function extractHiddenTabScreenNames(layoutSource: string): string[] {
  // Match the hiddenTabScreenNames array contents
  const arrayMatch = layoutSource.match(/hiddenTabScreenNames\s*=\s*\[([\s\S]*?)\]\s*as\s*const/);
  if (!arrayMatch) return [];

  return Array.from(arrayMatch[1].matchAll(/['"]([^'"]+)['"]/g)).map(m => m[1]);
}

function extractVisibleTabNames(layoutSource: string): string[] {
  // Match Tabs.Screen name= entries that are NOT in the hidden map
  const visible: string[] = [];
  for (const m of layoutSource.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)) {
    visible.push(m[1]);
  }
  return visible;
}

const layoutSource = readFile('app/(tabs)/_layout.tsx');
const hiddenNames = extractHiddenTabScreenNames(layoutSource);
const visibleTabNames = extractVisibleTabNames(layoutSource);
const allTabFiles = listTabsScreenFiles();

// Visible tab base names (strip /index suffix)
const visibleBases = visibleTabNames.map(n =>
  n.endsWith('/index') ? n.slice(0, -'/index'.length) : n
);

describe('(tabs) navigator registry', () => {
  it('hiddenTabScreenNames is present and non-empty in the layout', () => {
    expect(hiddenNames.length).toBeGreaterThan(0);
  });

  it('every non-visible (tabs) screen file is registered in hiddenTabScreenNames', () => {
    const phantom: string[] = [];

    for (const file of allTabFiles) {
      // Skip visible tab screens
      const isVisible = visibleBases.some(
        v => file === v || file === `${v}/index` || file.startsWith(`${v}/`)
      );
      if (isVisible) continue;

      // Must be in hidden list
      if (!hiddenNames.includes(file)) {
        phantom.push(file);
      }
    }

    if (phantom.length > 0) {
      const msg = [
        'These (tabs) screens are missing from hiddenTabScreenNames in app/(tabs)/_layout.tsx.',
        'Without registration, Expo Router renders them as visible phantom tabs with no icon.',
        'Add each to the hiddenTabScreenNames array:',
        ...phantom.map(s => `  '${s}'`),
      ].join('\n');
      throw new Error(msg);
    }
  });

  it('every entry in hiddenTabScreenNames has a corresponding screen file', () => {
    const stale: string[] = [];

    for (const name of hiddenNames) {
      if (!allTabFiles.includes(name)) {
        stale.push(name);
      }
    }

    if (stale.length > 0) {
      const msg = [
        'These hiddenTabScreenNames entries have no matching file in app/(tabs)/:',
        ...stale.map(s => `  '${s}'`),
        'Either create the file or remove the stale entry.',
      ].join('\n');
      throw new Error(msg);
    }
  });

  it('no safeGoBack call uses the banned /(tabs) bare root fallback', () => {
    const dirsToCheck = ['app', 'components', 'hooks', 'utils', 'context'];
    const found: string[] = [];

    function scan(dir: string) {
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scan(rel);
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
          const src = readFile(rel);
          const lines = src.split('\n');
          lines.forEach((line, i) => {
            if (/safeGoBack\([^)]*['"]\/\(tabs\)['"]/.test(line)) {
              found.push(`${rel}:${i + 1}: ${line.trim()}`);
            }
          });
        }
      }
    }

    for (const d of dirsToCheck) {
      scan(d);
    }

    if (found.length > 0) {
      throw new Error(
        [
          'safeGoBack with bare /(tabs) fallback found — use a specific tab route or tracked history instead:',
          ...found,
        ].join('\n')
      );
    }
  });

  it('router.replace to bare tabs root is not used anywhere in client code', () => {
    // This mirrors the pre-commit guardrail — belt-and-suspenders.
    const dirsToCheck = ['app', 'components', 'hooks', 'utils'];
    const found: string[] = [];

    function scan(dir: string) {
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scan(rel);
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
          const src = readFile(rel);
          const lines = src.split('\n');
          lines.forEach((line, i) => {
            if (/router\.replace\(['"]\/\(tabs\)['"]/.test(line)) {
              found.push(`${rel}:${i + 1}: ${line.trim()}`);
            }
          });
        }
      }
    }

    for (const d of dirsToCheck) {
      scan(d);
    }

    if (found.length > 0) {
      throw new Error(
        [
          "router.replace to bare /(tabs) root found — use safeGoBack(router, '/(tabs)/feed') instead:",
          ...found,
        ].join('\n')
      );
    }
  });
});
