import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const authRouteSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'auth.ts'), 'utf8');

describe('POST /auth/upgrade-to-coach paid-plan guard', () => {
  it('stores paid plans as pending checkout instead of granting them immediately', () => {
    expect(/const isPaidPlan = plan === 'veteran' \|\| plan === 'legend';/.test(authRouteSrc)).toBe(
      true
    );
    expect(/plan:\s*isPaidPlan \? 'rookie' : plan/.test(authRouteSrc)).toBe(true);
    expect(/pending_plan:\s*isPaidPlan \? plan : null/.test(authRouteSrc)).toBe(true);
    expect(/payment_pending:\s*isPaidPlan/.test(authRouteSrc)).toBe(true);
  });
});
