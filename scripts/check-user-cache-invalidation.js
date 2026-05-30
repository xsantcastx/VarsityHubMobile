#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

function resolveBaseSha() {
  const explicitBaseSha = process.env.GIT_BASE_SHA || process.argv[2];
  if (explicitBaseSha) return explicitBaseSha;

  try {
    return execFileSync('git', ['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim();
  } catch {
    const message =
      '[cache-guard] No base SHA provided. Set GIT_BASE_SHA or run from a git checkout with at least two commits.';
    if (process.env.ALLOW_GUARD_SKIP === '1') {
      console.warn(`${message} Skipping because ALLOW_GUARD_SKIP=1.`);
      process.exit(0);
    }
    console.error(message);
    process.exit(1);
  }
}

const baseSha = resolveBaseSha();
const headSha = process.env.GIT_HEAD_SHA || process.argv[3] || 'HEAD';

const allowedPaths = new Set(['server/src/lib/userCache.ts']);
const exemptToken = 'cache-invalidation-exempt';
const mutationPattern = /\b(?:prisma|tx|client|[A-Za-z_$][\w$]*)\.user\.update(?:Many)?\s*\(/;

function getDiff() {
  try {
    return execFileSync(
      'git',
      ['diff', '--unified=0', '--no-color', baseSha, headSha, '--', ':(glob)server/src/**/*.ts'],
      { encoding: 'utf8' }
    );
  } catch (error) {
    const stdout = error && typeof error.stdout === 'string' ? error.stdout : '';
    if (stdout) return stdout;
    throw error;
  }
}

const diff = getDiff();
if (!diff.trim()) {
  console.log('[cache-guard] No server TypeScript changes detected.');
  process.exit(0);
}

const findings = [];
let currentFile = null;
let pendingExemptComment = false;

for (const line of diff.split('\n')) {
  if (line.startsWith('diff --git ')) {
    currentFile = null;
    pendingExemptComment = false;
    continue;
  }

  if (line.startsWith('+++ b/')) {
    currentFile = line.slice(6);
    pendingExemptComment = false;
    continue;
  }

  if (!currentFile || allowedPaths.has(currentFile)) {
    continue;
  }

  if (!currentFile.startsWith('server/src/') || currentFile.includes('/__tests__/')) {
    continue;
  }

  if (line.startsWith('@@')) {
    pendingExemptComment = false;
    continue;
  }

  if (!line.startsWith('+') || line.startsWith('+++')) {
    continue;
  }

  const addedLine = line.slice(1);
  const hasExemptComment = addedLine.includes(exemptToken);
  if (hasExemptComment) {
    pendingExemptComment = true;
  }

  if (!mutationPattern.test(addedLine)) {
    continue;
  }

  if (hasExemptComment || pendingExemptComment) {
    pendingExemptComment = false;
    continue;
  }

  findings.push({
    file: currentFile,
    line: addedLine.trim(),
  });
}

if (findings.length > 0) {
  console.error(
    '\n[cache-guard] New raw prisma.user.update/updateMany usage detected without cache invalidation.'
  );
  console.error(
    '[cache-guard] Route/service code must use updateUserAndInvalidate() or add a deliberate // cache-invalidation-exempt comment.'
  );
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.line}`);
  }
  process.exit(1);
}

console.log('[cache-guard] No new raw prisma.user.update/updateMany violations found.');
