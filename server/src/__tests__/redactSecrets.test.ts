import { describe, it, expect } from '@jest/globals';
import { redactSecrets, safeErrorMessage } from '../lib/redactSecrets.js';

describe('redactSecrets', () => {
  it('redacts the real leaked Google Maps key from an axios error string', () => {
    const leaked =
      'AxiosError: connect ETIMEDOUT https://maps.googleapis.com/maps/api/geocode/json?address=06907&key=AIzaSyDhct-4heIbBF1w9l_64SC8VafmyQWWQlg';
    const out = redactSecrets(leaked);
    expect(out).not.toContain('AIzaSyDhct-4heIbBF1w9l_64SC8VafmyQWWQlg');
    expect(out).toContain('key=***');
    expect(out).toContain('address=06907'); // non-secret params preserved
  });

  it('redacts key whether it is the first or a later query param', () => {
    expect(redactSecrets('https://x/y?key=ABC123&z=1')).toBe('https://x/y?key=***&z=1');
    expect(redactSecrets('https://x/y?z=1&key=ABC123')).toBe('https://x/y?z=1&key=***');
  });

  it('redacts other secret-bearing param names', () => {
    expect(redactSecrets('?token=abc&api_key=def&apikey=ghi&secret=jkl&password=mno')).toBe(
      '?token=***&api_key=***&apikey=***&secret=***&password=***'
    );
  });

  it('leaves strings without secrets unchanged', () => {
    expect(redactSecrets('connect ETIMEDOUT at internalConnectMultiple')).toBe(
      'connect ETIMEDOUT at internalConnectMultiple'
    );
  });
});

describe('safeErrorMessage', () => {
  it('extracts and redacts an Error message', () => {
    expect(safeErrorMessage(new Error('Request failed for ?key=SECRET123'))).toBe(
      'Request failed for ?key=***'
    );
  });

  it('handles non-Error values', () => {
    expect(safeErrorMessage('?key=zzz')).toBe('?key=***');
    expect(safeErrorMessage(null)).toBe('null');
    expect(safeErrorMessage(undefined)).toBe('undefined');
  });

  it('caps message length', () => {
    expect(safeErrorMessage('x'.repeat(500)).length).toBe(300);
  });
});
