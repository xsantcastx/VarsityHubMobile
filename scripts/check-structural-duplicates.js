#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;

function rel(file) {
  return path.relative(root, file);
}

function fail(message) {
  failures += 1;
  console.error(`✗ ${message}`);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function walk(dir, predicate, out = []) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const fullPath = path.join(full, entry.name);
    const relativePath = rel(fullPath);
    if (entry.isDirectory()) {
      if (
        ['node_modules', '.git', '.expo', 'dist', 'coverage', 'build', 'DerivedData'].includes(
          entry.name
        ) ||
        relativePath.startsWith('.claude/')
      ) {
        continue;
      }
      walk(relativePath, predicate, out);
    } else if (predicate(relativePath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function checkPackageSectionOverlap() {
  let found = false;
  for (const file of ['package.json', 'server/package.json', 'shared/package.json']) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
    const devDeps = new Set(Object.keys(pkg.devDependencies || {}));
    const overlap = Object.keys(pkg.dependencies || {}).filter(name => devDeps.has(name));
    if (overlap.length) {
      found = true;
      fail(
        `${file} lists packages in both dependencies and devDependencies: ${overlap.join(', ')}`
      );
    }
  }
  if (!found) pass('no dependency/devDependency overlaps');
}

function checkDuplicateRouteRegistrations() {
  const files = walk(
    'server/src/routes',
    file => /\.(ts|js)$/.test(file) && !file.includes('__tests__')
  );
  const registrations = new Map();
  const routeRe = /(\w+Router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = routeRe.exec(source))) {
      const key = `${match[1]} ${match[2].toUpperCase()} ${match[3]}`;
      const list = registrations.get(key) || [];
      list.push(rel(file));
      registrations.set(key, list);
    }
  }

  const duplicates = [...registrations.entries()].filter(([, matches]) => matches.length > 1);
  for (const [route, matches] of duplicates) {
    fail(`duplicate Express route registration ${route}: ${matches.join(', ')}`);
  }
  if (duplicates.length === 0) pass('no duplicate same-router Express registrations');
}

function checkPrismaDuplicates() {
  const schemaPath = path.join(root, 'server/prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) return;
  const source = fs.readFileSync(schemaPath, 'utf8');
  let found = false;

  for (const kind of ['model', 'enum']) {
    const blocks = new Map();
    const re = new RegExp(`^${kind}\\s+(\\w+)\\s*{([\\s\\S]*?)^}`, 'gm');
    let match;
    while ((match = re.exec(source))) {
      const [, name, body] = match;
      const entries = blocks.get(name) || [];
      entries.push(match.index);
      blocks.set(name, entries);

      const fields = body
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//') && !line.startsWith('@@'))
        .map(line => line.split(/\s+/)[0])
        .filter(field => field && !field.startsWith('@'));
      const duplicateFields = [
        ...new Set(fields.filter((field, index) => fields.indexOf(field) !== index)),
      ];
      if (duplicateFields.length) {
        found = true;
        fail(`duplicate Prisma ${kind} fields in ${name}: ${duplicateFields.join(', ')}`);
      }
    }

    for (const [name, entries] of blocks) {
      if (entries.length > 1) {
        found = true;
        fail(`duplicate Prisma ${kind} definition: ${name}`);
      }
    }
  }

  if (!found) pass('Prisma model/enum definitions have no duplicate names or fields');
}

function checkExactDuplicateSourceFiles() {
  const sourceDirs = ['app', 'components', 'hooks', 'utils', 'api', 'server/src', 'shared'];
  const files = sourceDirs.flatMap(dir =>
    walk(dir, file => /\.(ts|tsx|js|jsx)$/.test(file) && !file.includes('__tests__'))
  );
  const byHash = new Map();

  for (const file of files) {
    const normalized = fs.readFileSync(file, 'utf8').replace(/\s+/g, ' ').trim();
    if (normalized.length < 200) continue;
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    const matches = byHash.get(hash) || [];
    matches.push(rel(file));
    byHash.set(hash, matches);
  }

  const duplicates = [...byHash.values()].filter(matches => matches.length > 1);
  for (const matches of duplicates) {
    fail(`exact duplicate source files: ${matches.join(', ')}`);
  }
  if (duplicates.length === 0) pass('no exact duplicate source files');
}

function routeKey(file) {
  let key = file.replace(/^app\//, '').replace(/\.(tsx|ts|jsx|js)$/, '');
  if (key.includes('__tests__')) return null;
  if (key.endsWith('/_layout') || key === '_layout') return null;
  key = key
    .replace(/\/index$/, '')
    .replace(/\([^/]+\)\//g, '')
    .replace(/^\([^/]+\)$/, '');
  return key || '/';
}

function isShim(file) {
  const source = fs
    .readFileSync(file, 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*/g, '')
    .trim();
  return /^export\s+\{\s*default\s+\}\s+from\s+['"][^'"]+['"];?$/.test(source);
}

function checkExpoRouteAliasImplementations() {
  const files = walk('app', file => /\.(ts|tsx|js|jsx)$/.test(file) && !file.includes('__tests__'));
  const byRoute = new Map();

  for (const file of files) {
    const key = routeKey(rel(file));
    if (!key) continue;
    const matches = byRoute.get(key) || [];
    matches.push(file);
    byRoute.set(key, matches);
  }

  let found = false;
  for (const [key, filesForRoute] of byRoute) {
    if (filesForRoute.length < 2) continue;
    const implementations = filesForRoute.filter(file => !isShim(file));
    if (implementations.length > 1) {
      found = true;
      fail(
        `Expo route "${key}" has multiple non-shim implementations: ${implementations
          .map(rel)
          .join(', ')}`
      );
    }
  }
  if (!found) pass('Expo route aliases have at most one implementation');
}

console.log('Checking structural duplicates...');
checkPackageSectionOverlap();
checkDuplicateRouteRegistrations();
checkPrismaDuplicates();
checkExactDuplicateSourceFiles();
checkExpoRouteAliasImplementations();

if (failures > 0) {
  console.error(`Structural duplicate audit failed: ${failures} issue(s).`);
  process.exit(1);
}

console.log('Structural duplicate audit passed.');
