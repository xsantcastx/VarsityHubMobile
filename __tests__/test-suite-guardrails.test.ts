import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const SCAN_ROOTS = ['__tests__', 'app', 'server/src/__tests__', 'server/tests', 'tests'];
const DB_HELPER = 'server/src/__tests__/helpers/dbTestSuite.ts';
const RUNNER_ROOTS = [
  '__tests__/',
  'app/',
  'components/',
  'hooks/',
  'utils/',
  'apiclient/',
  'context/',
  'constants/',
  'server/src/',
  'tests/',
];
function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'coverage') continue;
      walk(full, out);
    } else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(name) || name === 'dbTestSuite.ts') {
      out.push(full);
    }
  }
  return out;
}

function walkAllTests(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (
        name.startsWith('.') ||
        name === 'node_modules' ||
        name === 'dist' ||
        name === 'coverage' ||
        name === 'ios' ||
        name === 'android'
      ) {
        continue;
      }
      walkAllTests(full, out);
    } else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

describe('test-suite guardrails', () => {
  const files = SCAN_ROOTS.flatMap(root => walk(path.join(ROOT, root)));

  it('does not commit skipped, focused, or todo tests', () => {
    const offenders = files.flatMap(file => {
      const relative = rel(file);
      const source = fs.readFileSync(file, 'utf8');
      return source
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(
          ({ line }) =>
            /\.(?:skip|only|todo)\s*\(/.test(line) || /\b(?:xdescribe|xit|xtest)\s*\(/.test(line)
        )
        .map(({ index, line }) => `${relative}:${index + 1}: ${line.trim()}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps DB-backed tests impossible to skip by environment', () => {
    const offenders = files.flatMap(file => {
      const relative = rel(file);
      if (relative === DB_HELPER) return [];
      if (relative === '__tests__/test-suite-guardrails.test.ts') return [];
      const source = fs.readFileSync(file, 'utf8');
      return source.includes('SKIP_SERVER_DB_TESTS') || source.includes('describe.skip')
        ? [relative]
        : [];
    });

    expect(offenders).toEqual([]);

    const helper = fs.readFileSync(path.join(ROOT, DB_HELPER), 'utf8');
    expect(helper).toContain('SKIP_SERVER_DB_TESTS');
    expect(helper).toContain('throw new Error');
    expect(helper).not.toContain('describe.skip');
  });

  it('keeps test files inside configured runner roots', () => {
    const orphaned = walkAllTests(ROOT)
      .map(rel)
      .filter(relative => !RUNNER_ROOTS.some(root => relative.startsWith(root)));

    expect(orphaned).toEqual([]);
  });
});
