#!/usr/bin/env node

/**
 * Guard: fail if any seed/template or client file references an image URL from a
 * host that is not known-free-to-use. Prevents copyrighted stadium photos,
 * broadcast stills, or trademarked logos from creeping back into event/game
 * templates. Scans committed files only (git ls-files).
 *
 * Allowed image hosts:
 *   - placehold.co            (generic placeholders)
 *   - ui-avatars.com          (generated text monograms)
 *   - res.cloudinary.com      (our own uploaded/hosted media)
 *   - images.unsplash.com     (Unsplash license — free commercial use)
 *   - *.openstreetmap.org / basemaps.cartocdn.com (open map tiles)
 *   - example.com / cdn.example.com (test fixtures)
 *   - upload.wikimedia.org ONLY for /Flag_of… (public-domain national flags)
 *
 * Anything else (Getty, Shutterstock, ESPN/broadcast CDNs, or a non-flag
 * Wikimedia file — i.e. a stadium/logo photo) fails the check.
 */

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const repoRoot = process.cwd();

// Files to scan: seed/template data + client UI. These are where a hardcoded
// image could ship to users. Server route/lib code is data-driven (user uploads).
const SCAN_PREFIXES = ['server/scripts/', 'app/', 'components/', 'constants/', 'shared/'];
const SCAN_EXT = /\.(ts|tsx|js|jsx|json)$/;

const IMAGE_URL_RE = /https?:\/\/[^\s'"`)\\]+?\.(?:jpg|jpeg|png|webp|gif|svg)(?:\?[^\s'"`)\\]*)?/gi;

// Domain suffixes; a host matches if it equals the suffix or is a subdomain of
// it. Handles Leaflet `{s}.` tile templates and a/b/c tile subdomains.
const ALLOWED_SUFFIXES = [
  'placehold.co',
  'ui-avatars.com',
  'cloudinary.com', // our own hosted/uploaded media (res.cloudinary.com)
  'unsplash.com', // Unsplash license — free commercial use (images.unsplash.com)
  'cartocdn.com', // open map tiles
  'openstreetmap.org', // open map tiles
  'example.com', // test fixtures
];

function hostOf(url) {
  const m = url.match(/^https?:\/\/([^/]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function matchesSuffix(host, suffix) {
  return host === suffix || host.endsWith('.' + suffix);
}

// A wikimedia URL is allowed only for public-domain national flags (/Flag_of…).
function isAllowed(url) {
  const host = hostOf(url);
  if (ALLOWED_SUFFIXES.some(s => matchesSuffix(host, s))) return true;
  if (matchesSuffix(host, 'wikimedia.org')) return /Flag_of/i.test(url);
  return false;
}

let files = [];
try {
  files = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(f => SCAN_PREFIXES.some(p => f.startsWith(p)) && SCAN_EXT.test(f));
} catch (err) {
  console.error('[check-template-images] Failed to list files:', err.message);
  process.exit(1);
}

const violations = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const matches = line.match(IMAGE_URL_RE);
    if (!matches) return;
    for (const url of matches) {
      if (!isAllowed(url)) {
        violations.push({ file, line: i + 1, host: hostOf(url) });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('\n✖ Disallowed image host(s) found in templates/UI — possible copyrighted/trademarked media:\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  (host: ${v.host})`);
  }
  console.error('\nUse only free-to-use images: your own Cloudinary uploads, placehold.co,');
  console.error('ui-avatars.com, images.unsplash.com, or public-domain Wikimedia flags (/Flag_of…).');
  console.error('If a host is legitimately free-to-use, add it to ALLOWED_HOSTS in scripts/check-template-images.js.\n');
  process.exit(1);
}

console.log('Template image-host scan passed.');
