import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('POST /auth/verify/request response contract', () => {
  it('returns verification_email_sent and verification_email_error so clients can surface delivery failure', () => {
    const authSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'auth.ts'), 'utf8');

    expect(authSrc).toContain("verification_email_sent: sent");
    expect(authSrc).toContain("payload.verification_email_error = 'EMAIL_DELIVERY_FAILED'");
    expect(authSrc).toContain("verification_email_error: 'EMAIL_DELIVERY_EXCEPTION'");
  });
});
