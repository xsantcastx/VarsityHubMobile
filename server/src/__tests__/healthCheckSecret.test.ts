import { describe, expect, it } from '@jest/globals';
import { resolveHealthCheckSecret } from '../lib/healthCheckSecret.js';

describe('resolveHealthCheckSecret', () => {
  it('prefers the canonical env var when present', () => {
    expect(
      resolveHealthCheckSecret({
        HEALTH_CHECK_SECRET: 'canonical-secret',
        'HEALTH_CHECK_SECRET ': 'legacy-secret',
      })
    ).toBe('canonical-secret');
  });

  it('falls back to a malformed trailing-space env key', () => {
    expect(
      resolveHealthCheckSecret({
        'HEALTH_CHECK_SECRET ': 'legacy-secret',
      })
    ).toBe('legacy-secret');
  });

  it('trims whitespace around the resolved value', () => {
    expect(
      resolveHealthCheckSecret({
        HEALTH_CHECK_SECRET: '  spaced-secret  ',
      })
    ).toBe('spaced-secret');
  });
});
