#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const baseSha = process.env.GIT_BASE_SHA || process.argv[2];
const headSha = process.env.GIT_HEAD_SHA || process.argv[3] || 'HEAD';

if (!baseSha) {
  console.log('[error-guard] No base SHA provided; skipping error envelope guard.');
  process.exit(0);
}

const exemptToken = 'error-envelope-exempt';
const allowedPaths = new Set(['server/src/lib/http/sendError.ts']);

function getDiff() {
  const args = ['diff', '--unified=0', '--no-color', baseSha];
  if (headSha !== 'WORKTREE') {
    args.push(headSha);
  }
  args.push('--', ':(glob)server/src/**/*.ts');

  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch (error) {
    const stdout = error && typeof error.stdout === 'string' ? error.stdout : '';
    if (stdout) return stdout;
    throw error;
  }
}

function maybeRecordViolation(state, findings) {
  if (!state.currentFile || allowedPaths.has(state.currentFile) || state.exempt) {
    return;
  }

  const snippet = state.buffer.join(' ').trim();
  if (!/res(?:\.status\([^)]*\))?\.json\s*\(/.test(snippet)) return;
  if (!/\berror\s*:/.test(snippet)) return;
  if (/\bsendError\s*\(/.test(snippet)) return;

  findings.push({
    file: state.currentFile,
    snippet,
  });
}

const diff = getDiff();
if (!diff.trim()) {
  console.log('[error-guard] No server changes detected.');
  process.exit(0);
}

const findings = [];
const state = {
  currentFile: null,
  collecting: false,
  exempt: false,
  buffer: [],
};

for (const line of diff.split('\n')) {
  if (line.startsWith('diff --git ')) {
    maybeRecordViolation(state, findings);
    state.currentFile = null;
    state.collecting = false;
    state.exempt = false;
    state.buffer = [];
    continue;
  }

  if (line.startsWith('+++ b/')) {
    state.currentFile = line.slice(6);
    continue;
  }

  if (!state.currentFile) continue;
  if (state.currentFile.includes('/__tests__/')) continue;

  if (line.startsWith('@@')) {
    maybeRecordViolation(state, findings);
    state.collecting = false;
    state.exempt = false;
    state.buffer = [];
    continue;
  }

  if (!line.startsWith('+') || line.startsWith('+++')) {
    continue;
  }

  const addedLine = line.slice(1);

  if (!state.collecting && /\bres(?:\.status\([^)]*\))?\.json\s*\(/.test(addedLine)) {
    state.collecting = true;
    state.exempt = addedLine.includes(exemptToken);
    state.buffer = [addedLine];

    if (/\)\s*;?\s*$/.test(addedLine)) {
      maybeRecordViolation(state, findings);
      state.collecting = false;
      state.exempt = false;
      state.buffer = [];
    }
    continue;
  }

  if (!state.collecting) continue;

  state.buffer.push(addedLine);
  if (addedLine.includes(exemptToken)) state.exempt = true;

  if (/\)\s*;?\s*$/.test(addedLine)) {
    maybeRecordViolation(state, findings);
    state.collecting = false;
    state.exempt = false;
    state.buffer = [];
  }
}

maybeRecordViolation(state, findings);

if (findings.length > 0) {
  console.error('\n[error-guard] New error responses must use sendError().');
  console.error(
    '[error-guard] Replace raw res.status(...).json({ error: ... }) with sendError(...) or add // error-envelope-exempt.'
  );
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.snippet}`);
  }
  process.exit(1);
}

console.log('[error-guard] No new raw error envelope violations found.');
