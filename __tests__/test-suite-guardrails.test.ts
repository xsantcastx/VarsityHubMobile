import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const SCAN_ROOTS = ['__tests__', 'app', 'server/src/__tests__'];
const ALLOWED_DESCRIBE_SKIP = 'server/src/__tests__/helpers/dbTestSuite.ts';

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

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

describe('test-suite guardrails', () => {
  const files = SCAN_ROOTS.flatMap(root => walk(path.join(ROOT, root)));

  it('does not commit skipped tests outside the centralized DB-test helper', () => {
    const offenders = files.flatMap(file => {
      const relative = rel(file);
      const source = fs.readFileSync(file, 'utf8');
      return source
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => /\.(?:skip|todo)\s*\(/.test(line))
        .filter(({ line }) => !(relative === ALLOWED_DESCRIBE_SKIP && /describe\.skip/.test(line)))
        .map(({ index, line }) => `${relative}:${index + 1}: ${line.trim()}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps DB-backed test skip policy centralized', () => {
    const offenders = files.flatMap(file => {
      const relative = rel(file);
      if (relative === ALLOWED_DESCRIBE_SKIP) return [];
      if (relative === '__tests__/test-suite-guardrails.test.ts') return [];
      const source = fs.readFileSync(file, 'utf8');
      return source.includes('SKIP_SERVER_DB_TESTS') || source.includes('process.env.CI')
        ? [relative]
        : [];
    });

    expect(offenders).toEqual([]);
  });
});
