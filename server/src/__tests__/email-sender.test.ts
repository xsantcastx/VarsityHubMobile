import { describe, expect, it } from '@jest/globals';
import {
  CANONICAL_EMAIL_FROM,
  isCanonicalEmailFrom,
  resolveEmailFrom,
} from '../lib/emailSender.js';

describe('email sender resolution', () => {
  it('defaults to the canonical noreply sender', () => {
    expect(resolveEmailFrom({ EMAIL_FROM: undefined, FROM_EMAIL: undefined })).toBe(
      CANONICAL_EMAIL_FROM
    );
  });

  it('prefers EMAIL_FROM over FROM_EMAIL', () => {
    expect(
      resolveEmailFrom({
        EMAIL_FROM: 'noreply@varsityhub.app',
        FROM_EMAIL: 'customerservice@varsityhub.app',
      })
    ).toBe(CANONICAL_EMAIL_FROM);
  });

  it('trims whitespace from sender env vars', () => {
    expect(
      resolveEmailFrom({
        EMAIL_FROM: '  noreply@varsityhub.app  ',
        FROM_EMAIL: undefined,
      })
    ).toBe(CANONICAL_EMAIL_FROM);
  });

  it('detects non-canonical sender drift', () => {
    expect(isCanonicalEmailFrom('customerservice@varsityhub.app')).toBe(false);
    expect(isCanonicalEmailFrom('noreply@varsityhub.app')).toBe(true);
  });
});
