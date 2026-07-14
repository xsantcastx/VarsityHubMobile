/**
 * Regression: renderAppHandoffPage must escape title/description itself.
 * Previously escaping was call-site discipline only — safe today, one
 * forgotten escapeHtml() away from reflected XSS (2026-07-13 audit).
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'routes', 'publicAppHandoff.ts'), 'utf8');
const fnStart = src.indexOf('function renderAppHandoffPage');
const fnEnd = src.indexOf('\n}', fnStart) + 2;
const helper = src.slice(fnStart, fnEnd);

describe('renderAppHandoffPage escaping', () => {
  it('escapes title and description inside the helper', () => {
    expect(helper).toMatch(/const safeTitle = escapeHtml\(title\)/);
    expect(helper).toMatch(/const safeDescription = escapeHtml\(description\)/);
    expect(helper).toMatch(/<title>\$\{safeTitle\}<\/title>/);
  });
  it('call sites no longer pre-escape values passed into description (no double-escaping)', () => {
    // Any escapeHtml(...) interpolated inside a template literal that is an
    // argument in a renderAppHandoffPage call's description would now
    // double-escape. The email-interpolating sites must pass raw values.
    const callSiteSection = src.slice(fnEnd);
    expect(callSiteSection).not.toMatch(/for \$\{escapeHtml\(state\.email\)\}/);
    expect(callSiteSection).not.toMatch(/for \$\{escapeHtml\(email\)\}/);
  });
});
