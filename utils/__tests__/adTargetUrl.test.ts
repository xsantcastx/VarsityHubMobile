import { describe, expect, it } from '@jest/globals';

import { isValidAdTargetUrl, normalizeAdTargetUrl } from '../adTargetUrl';

describe('ad target URL helpers', () => {
  it('adds https when a user enters a bare domain', () => {
    expect(normalizeAdTargetUrl('varsityhub.app')).toBe('https://varsityhub.app');
  });

  it('upgrades insecure http links to https', () => {
    expect(normalizeAdTargetUrl('http://varsityhub.app')).toBe('https://varsityhub.app');
  });

  it('preserves existing https links', () => {
    expect(normalizeAdTargetUrl('https://varsityhub.app/path')).toBe('https://varsityhub.app/path');
  });

  it('rejects non-web schemes', () => {
    expect(isValidAdTargetUrl('javascript:alert(1)')).toBe(false);
    expect(isValidAdTargetUrl('ftp://varsityhub.app')).toBe(false);
  });
});
