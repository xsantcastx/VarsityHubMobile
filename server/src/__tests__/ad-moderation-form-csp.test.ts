/**
 * Regression test: the ad moderation email confirmation form must work without
 * JavaScript.
 *
 * Why this exists:
 *   The app-wide Helmet CSP (script-src 'self' + a hash allowlist,
 *   script-src-attr 'none') applies to the server-rendered approve/reject
 *   confirmation pages. The original form relied on an inline <script> and an
 *   onsubmit= attribute — both blocked by that CSP — so tapping "Approve Ad"
 *   fell through to a native GET form submission, which REPLACES the query
 *   string and drops ?token=, producing a 401 "Invalid Link" page. Railway
 *   HTTP logs showed the signature: GET 200 (form) followed seconds later by
 *   GET 401, and never a POST (2026-07-06 incident).
 *
 *   Fix: a plain HTML <form method="POST" action="?token=..."> — no inline
 *   script, no on* attributes — parsed server-side by express.urlencoded.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const adsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'ads.ts'), 'utf8');

// confirmationForm is module-private and non-async, so the shared
// extractFunctionBody helper (which anchors on `export async function`) does
// not apply. The function ends at the first column-0 closing brace after its
// declaration.
function extractConfirmationForm(source: string): string {
  const start = source.indexOf('function confirmationForm(');
  if (start === -1) throw new Error('Could not locate confirmationForm in ads.ts');
  const end = source.indexOf('\n}', start);
  if (end === -1) throw new Error('Could not find end of confirmationForm');
  return source.slice(start, end + 2);
}

describe('ad moderation confirmation form is CSP-safe (no JS required)', () => {
  const formBody = extractConfirmationForm(adsSrc);

  it('contains no inline <script> block', () => {
    expect(formBody).not.toMatch(/<script/i);
  });

  it('contains no inline event-handler attributes (script-src-attr is none)', () => {
    expect(formBody).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('submits as a native POST', () => {
    expect(formBody).toMatch(/method="POST"/);
  });

  it('preserves the review token in the form action query string', () => {
    expect(formBody).toMatch(/action="\$\{safeFormAction\}"/);
    expect(formBody).toMatch(/\?token=\$\{encodeURIComponent\(token\)\}/);
  });

  it('carries the override flag as a form field when the banner is flagged', () => {
    expect(formBody).toMatch(/name="override_banner_flag"/);
  });

  it('keeps the named override reason field for the flagged path', () => {
    expect(formBody).toMatch(/name="override_reason"/);
  });
});
