#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const baseSha = process.env.GIT_BASE_SHA || process.argv[2];
const headSha = process.env.GIT_HEAD_SHA || process.argv[3] || 'HEAD';

if (!baseSha) {
  console.log('[async-guard] No base SHA provided; skipping asyncHandler guard.');
  process.exit(0);
}

const exemptToken = 'async-handler-exempt';
const routeStartPattern =
  /\b[A-Za-z_$][\w$]*Router\.(?:get|post|put|patch|delete|options|head|all|use)\s*\(/;

function getDiff() {
  const args = ['diff', '--unified=0', '--no-color', baseSha];
  if (headSha !== 'WORKTREE') {
    args.push(headSha);
  }
  args.push('--', ':(glob)server/src/routes/**/*.ts');

  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch (error) {
    const stdout = error && typeof error.stdout === 'string' ? error.stdout : '';
    if (stdout) return stdout;
    throw error;
  }
}

function maybeRecordViolation(state, findings) {
  if (!state.currentFile || state.exempt || !state.sawAsync || state.sawAsyncHandler) {
    return;
  }

  findings.push({
    file: state.currentFile,
    snippet: state.buffer.join(' ').trim(),
  });
}

const diff = getDiff();
if (!diff.trim()) {
  console.log('[async-guard] No route changes detected.');
  process.exit(0);
}

const findings = [];
const state = {
  currentFile: null,
  inRouteBlock: false,
  sawAsync: false,
  sawAsyncHandler: false,
  exempt: false,
  buffer: [],
};

for (const line of diff.split('\n')) {
  if (line.startsWith('diff --git ')) {
    maybeRecordViolation(state, findings);
    state.currentFile = null;
    state.inRouteBlock = false;
    state.sawAsync = false;
    state.sawAsyncHandler = false;
    state.exempt = false;
    state.buffer = [];
    continue;
  }

  if (line.startsWith('+++ b/')) {
    state.currentFile = line.slice(6);
    continue;
  }

  if (!state.currentFile) continue;

  if (line.startsWith('@@')) {
    maybeRecordViolation(state, findings);
    state.inRouteBlock = false;
    state.sawAsync = false;
    state.sawAsyncHandler = false;
    state.exempt = false;
    state.buffer = [];
    continue;
  }

  if (!line.startsWith('+') || line.startsWith('+++')) {
    continue;
  }

  const addedLine = line.slice(1);

  if (!state.inRouteBlock && routeStartPattern.test(addedLine)) {
    state.inRouteBlock = true;
    state.sawAsync = /\basync\s*\(/.test(addedLine);
    state.sawAsyncHandler = /\basyncHandler\s*\(/.test(addedLine);
    state.exempt = addedLine.includes(exemptToken);
    state.buffer = [addedLine];

    if (/\)\s*;?\s*$/.test(addedLine)) {
      maybeRecordViolation(state, findings);
      state.inRouteBlock = false;
      state.sawAsync = false;
      state.sawAsyncHandler = false;
      state.exempt = false;
      state.buffer = [];
    }
    continue;
  }

  if (!state.inRouteBlock) {
    continue;
  }

  state.buffer.push(addedLine);
  if (addedLine.includes(exemptToken)) state.exempt = true;
  if (/\basync\s*\(/.test(addedLine)) state.sawAsync = true;
  if (/\basyncHandler\s*\(/.test(addedLine)) state.sawAsyncHandler = true;

  if (/\)\s*;?\s*$/.test(addedLine)) {
    maybeRecordViolation(state, findings);
    state.inRouteBlock = false;
    state.sawAsync = false;
    state.sawAsyncHandler = false;
    state.exempt = false;
    state.buffer = [];
  }
}

maybeRecordViolation(state, findings);

if (findings.length > 0) {
  console.error('\n[async-guard] New async route handlers must be wrapped in asyncHandler().');
  console.error(
    '[async-guard] Add asyncHandler(...) or a deliberate // async-handler-exempt comment.'
  );
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.snippet}`);
  }
  process.exit(1);
}

console.log('[async-guard] No new raw async route handlers found.');
