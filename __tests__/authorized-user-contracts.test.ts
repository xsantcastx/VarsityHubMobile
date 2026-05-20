import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const organizationScreen = read('app/(tabs)/organization.tsx');
const organizationsRoute = read('server/src/routes/organizations.ts');
const teamInvitesRoute = read('server/src/routes/team-invites.ts');
const approvalsScreen = read('app/(tabs)/event-approvals.tsx');
const teamRoute = read('server/src/routes/teams.ts');
const settingsScreen = read('app/settings/index.tsx');
const apiTypes = read('api/types.ts');
const onboardingContext = read('context/OnboardingContext.tsx');

describe('authorized-user contracts', () => {
  it('organization tools expose the org invite path and pending invite state', () => {
    expect(organizationScreen).toContain('Organization.invite(');
    expect(organizationScreen).toContain('Organization.cancelInvite(');
    expect(organizationScreen).toContain('pending_authorized_invites');
    expect(organizationScreen).toContain('authorized_invites');
  });

  it('organization admin-summary includes pending authorized invite data for the frontend', () => {
    expect(organizationsRoute).toContain('pending_authorized_invites');
    expect(organizationsRoute).toContain('authorized_invites: pendingInvites.map(serializeOrganizationAdminInvite)');
    expect(organizationsRoute).toContain("'/:id/invite'");
  });

  it('team invite fallback route sends canonical invite links and uses the scoped authorized-user limit set', () => {
    expect(teamInvitesRoute).toContain('inviteToken: invite.id');
    expect(teamInvitesRoute).toContain('TEAM_AUTHORIZED_ROLES');
    expect(teamInvitesRoute).toContain('getTeamEntitlementState');
  });

  it('team routes expose invite cancellation and avoid stale admin-summary pending invite fields', () => {
    expect(teamRoute).not.toContain('pending_invites');
    expect(teamRoute).not.toContain('pendingInvites');
    expect(teamRoute).toContain("'/:id/invites/:inviteId/cancel'");
  });

  it('approvals copy distinguishes organization join requests from authorized-user invites', () => {
    expect(approvalsScreen).toContain('Organization Join Requests');
    expect(approvalsScreen).not.toContain('Authorized User Requests');
  });

  it('settings restart flow maps legacy authorized-user prefs into canonical onboarding state', () => {
    expect(settingsScreen).toContain('authorized_users: prefsFromServer.authorized_users ?? prefsFromServer.authorized ?? []');
  });

  it('frontend onboarding contracts no longer carry dead authorized-users state', () => {
    expect(apiTypes).not.toContain('authorized_users?: Array');
    expect(onboardingContext).not.toContain('authorized_users?: Array');
    expect(onboardingContext).not.toContain('authorized?: Array');
  });
});
