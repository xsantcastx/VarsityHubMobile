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
// Email canonicalization for invites lives here now, not inline in the route.
const inviteIdentifierSrc = readFileSync(
  join(process.cwd(), 'src', 'lib', 'inviteIdentifier.ts'),
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
    expect(organizationsSrc).toMatch(
      /organizationsRouter\.post\(\s*'\/invites\/:inviteId\/accept'[\s\S]*?sendStaffMemberJoinedEmail\(\{/
    );
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
    // Normalization used to be an inline `email.trim().toLowerCase()` in this route.
    // The username-or-email invite work moved it into resolveInviteIdentifier(), which
    // is now the single canonicalization point. Assert the invariant (the address that
    // reaches the DB is lowercased by the resolver), not the old literal.
    expect(organizationsSrc).toMatch(/const resolvedIdentifier = await resolveInviteIdentifier\(/);
    expect(organizationsSrc).toMatch(/const inviteEmail = resolvedIdentifier\.email;/);
    expect(inviteIdentifierSrc).toMatch(/email:\s*identifier\.toLowerCase\(\)/);
    expect(inviteIdentifierSrc).toMatch(/email:\s*user\.email\.toLowerCase\(\)/);
    expect(organizationsSrc).toMatch(
      /organizationInvite\.findFirst\(\{[\s\S]*?email:\s*\{\s*equals:\s*inviteEmail,\s*mode:\s*'insensitive'\s*\}/
    );
    expect(organizationsSrc).toMatch(/data:\s*\{\s*organization_id:\s*id,\s*email:\s*inviteEmail,/);
  });
});
