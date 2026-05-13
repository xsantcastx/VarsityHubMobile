#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const tokenPatterns = [
  /\bsntryu_[A-Za-z0-9]{20,}\b/g,
];
const ignoreGlobs = [
  'package-lock.json',
  'ios/Podfile.lock',
];

function shouldIgnore(file) {
  return ignoreGlobs.some((ignored) => file === ignored);
}

let files = [];
try {
  const stdout = execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  files = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !shouldIgnore(file));
} catch {
  console.error('Unable to enumerate git-tracked files for secret scan.');
  process.exit(1);
}

const findings = [];

for (const relativePath of files) {
  let content;
  try {
    content = readFileSync(path.join(repoRoot, relativePath), 'utf8');
  } catch {
    continue;
  }

  for (const pattern of tokenPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      findings.push({
        path: relativePath,
        preview: match[0].slice(0, 10) + '...[redacted]',
      });
      break;
    }
  }
}

if (findings.length > 0) {
  console.error('Secret literal scan failed. Remove token-like values from tracked files:');
  for (const finding of findings) {
    console.error(`- ${finding.path}: ${finding.preview}`);
  }
  process.exit(1);
}

console.log('Secret literal scan passed.');
