/**
 * Regression test: org invite acceptance/decline must stay mailbox-bound and
 * pending-only, matching the stronger team-invite behavior.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const organizationsSrc = readFileSync(
  join(process.cwd(), 'src', 'routes', 'organizations.ts'),
  'utf8'
);

describe('organization invite guards', () => {
  it('accept route compares emails case-insensitively and only transitions pending invites', () => {
    expect(organizationsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/invites\/:inviteId\/accept'[\s\S]*?user\.email\.toLowerCase\(\)\s*!==\s*invite\.email\.toLowerCase\(\)/
    );
    expect(organizationsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/invites\/:inviteId\/accept'[\s\S]*?organizationInvite\.updateMany\(\{/
    );
    expect(organizationsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/invites\/:inviteId\/accept'[\s\S]*?where:\s*\{\s*id:\s*inviteId,\s*status:\s*'pending'\s*\}/
    );
    expect(organizationsSrc).toMatch(/Invite already processed/);
  });

  it('decline route also guards on case-insensitive mailbox match and pending-only updates', () => {
    expect(organizationsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/invites\/:inviteId\/decline'[\s\S]*?user\.email\.toLowerCase\(\)\s*!==\s*invite\.email\.toLowerCase\(\)/
    );
    expect(organizationsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/invites\/:inviteId\/decline'[\s\S]*?organizationInvite\.updateMany\(\{/
    );
    expect(organizationsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/invites\/:inviteId\/decline'[\s\S]*?where:\s*\{\s*id:\s*inviteId,\s*status:\s*'pending'\s*\}/
    );
  });

  it('direct org invites normalize the stored recipient email before lookup and write', () => {
    expect(organizationsSrc).toMatch(/const inviteEmail = email\.trim\(\)\.toLowerCase\(\)/);
    expect(organizationsSrc).toMatch(
      /organizationInvite\.findFirst\(\{[\s\S]*?email:\s*\{\s*equals:\s*inviteEmail,\s*mode:\s*'insensitive'\s*\}/
    );
    expect(organizationsSrc).toMatch(/data:\s*\{\s*organization_id:\s*id,\s*email:\s*inviteEmail,/);
  });
});
