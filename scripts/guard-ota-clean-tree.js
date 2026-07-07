#!/usr/bin/env node
/**
 * OTA publish guard: every published JS bundle must be reproducible from a
 * commit. Publishing from a dirty tree already shipped un-debuggable states
 * (error strings that exist in no commit). Refuses when the tree is dirty.
 */
const { execSync } = require('child_process');

const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty) {
  console.error('[ota-guard] REFUSING to publish an OTA from a dirty working tree.');
  console.error('[ota-guard] Commit (or stash) everything first — published bundles must be reproducible from a commit.');
  console.error('[ota-guard] Dirty files (first 15):');
  console.error(
    dirty
      .split('\n')
      .slice(0, 15)
      .map(l => `  ${l}`)
      .join('\n')
  );
  process.exit(1);
}

const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
console.log(`[ota-guard] Clean tree at ${sha} — OK to publish.`);
