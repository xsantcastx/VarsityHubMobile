#!/usr/bin/env node
/**
 * Phantom-dependency guard.
 *
 * Finds packages that client code imports/require()s but that are NOT declared
 * in package.json. TypeScript can't catch this (require() is untyped, and the
 * failures are usually swallowed by a try/catch fallback), so a missing native
 * module silently disables a feature in production — e.g. react-native-compressor,
 * which left every video upload uncompressed and bouncing off the 50 MB cap.
 *
 * Exit codes:
 *   1  a package is imported but cannot be resolved at all  (truly missing — fail)
 *   0  clean, or only "fragile" cases (resolves transitively but not declared)
 *
 * Usage: node scripts/check-phantom-deps.cjs   (npm run check:deps)
 */
const fs = require('fs');
const cp = require('child_process');

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]);

// Aliases (@/...), relative paths, and RN/runtime-provided modules are not deps.
const ignore = /^(\.|@\/|react$|react-dom$|react-native$|expo$)/;

const files = cp
  .execSync(
    'grep -rlE "from .[a-zA-Z@]|require\\(" app components hooks utils api --include=*.ts --include=*.tsx 2>/dev/null || true'
  )
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

const re = /(?:require\(|from )['"]([^'".][^'"]*)['"]/g;
const found = {}; // name -> Set(files)
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    if (ignore.test(spec) || spec.startsWith('node:')) continue;
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!declared.has(name)) (found[name] ||= new Set()).add(f);
  }
}

const missing = [];
const fragile = [];
for (const name of Object.keys(found).sort()) {
  let resolves = true;
  try {
    require.resolve(name, { paths: [ROOT] });
  } catch {
    resolves = false;
  }
  (resolves ? fragile : missing).push([name, [...found[name]]]);
}

for (const [name, fls] of fragile) {
  console.warn(
    `⚠️  FRAGILE: "${name}" is imported but not a direct dependency (resolves transitively). ${fls[0]}`
  );
}
for (const [name, fls] of missing) {
  console.error(`❌ MISSING: "${name}" is imported but NOT installed/declared. ${fls.slice(0, 2).join(', ')}`);
}

if (missing.length) {
  console.error(`\n${missing.length} phantom dependency(ies) cannot be resolved. Run: npx expo install <pkg>`);
  process.exit(1);
}
console.log(
  `✓ No unresolvable phantom imports${
    fragile.length ? ` (${fragile.length} fragile transitive-only — consider declaring directly)` : ''
  }.`
);
