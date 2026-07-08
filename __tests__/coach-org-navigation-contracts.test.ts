import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const teamPage = read('app/team-page.tsx');
const teamAdmin = read('app/team-admin.tsx');
const createTeam = read('app/(tabs)/create-team.tsx');
const editOrganization = read('app/(tabs)/edit-organization.tsx');
const approvals = read('app/(tabs)/approvals.tsx');
const editEvent = read('app/(tabs)/edit-event.tsx');
const editTeam = read('app/(tabs)/edit-team.tsx');
const manageTeams = read('app/(tabs)/manage-teams.tsx');
const eventApprovals = read('app/(tabs)/event-approvals.tsx');
const eventDetail = read('app/(tabs)/event-detail.tsx');
const myTeam = read('app/(tabs)/my-team.tsx');
const manageUsers = read('app/manage-users.tsx');
const manageSeason = read('app/manage-season.tsx');
const organizationScreen = read('app/(tabs)/organization.tsx');
const organizationDetail = read('app/organizations/[id].tsx');
const organizationJoinRequests = read('app/organization-join-requests.tsx');
const step3League = read('app/onboarding/step-3-league.tsx');
const mobileCommunity = read('app/(tabs)/discover/mobile-community.tsx');
const createEntry = read('app/create.tsx');
const coachAccess = read('utils/coachAccess.ts');

describe('coach/org navigation contracts', () => {
  it('team page routes the organization button to the canonical organization tools screen', () => {
    expect(teamPage).toContain("pathname: '/organization'");
    expect(teamPage).toContain("tab: 'overview'");
    expect(teamPage).not.toContain("pathname: '/league'");
  });

  it('team page uses the scoped screen summary contract and routes admin controls into team tools', () => {
    expect(teamPage).toContain('Team.screenSummary(teamId)');
    expect(teamPage).not.toContain('Team.members(teamData.id)');
    expect(teamPage).not.toContain('Organization.members(orgId)');
    expect(teamPage).toContain("pathname: '/team-admin'");
  });

  it('organization sharing owns the QR flow, while team pages only keep link sharing', () => {
    expect(teamPage).not.toContain('react-native-qrcode-svg');
    expect(teamPage).not.toContain('team-page-save-qr-button');
    expect(organizationDetail).toContain('react-native-qrcode-svg');
    expect(organizationDetail).toContain('organization-page-save-qr-button');
    expect(organizationDetail).toContain("kind: 'organization'");
  });

  it('team admin back navigation returns to the organization teams tab', () => {
    expect(teamAdmin).toContain("'/organization?tab=teams'");
  });

  it('team admin staff tooling surfaces pending invites from the scoped team admin summary', () => {
    expect(teamAdmin).toContain('pending_invites');
    expect(teamAdmin).toContain('Pending Invites');
    expect(teamAdmin).toContain('Team.cancelInvite(');
    expect(teamAdmin).toContain('Team.adminSummary(nextTeamId)');
  });

  it('team creation fallback routes back to organization tools, not manage-teams', () => {
    expect(createEntry).toContain(
      "import { useCreateTeamAccess } from '@/hooks/useCreateTeamAccess';"
    );
    expect(createEntry).toContain('const { canAccessCreateTeam, loading: createAccessLoading } =');
    expect(createEntry).toContain('useCreateTeamAccess();');
    expect(createEntry).not.toContain('isApprovedCoach &&');
    expect(createEntry).toContain("router.replace('/verify-identity?method=email')");
    expect(createEntry).toContain('router.replace(path as any);');
    expect(createEntry).not.toContain('router.push(path as any);');
    expect(createTeam).toContain(
      "import { useCreateTeamAccess } from '@/hooks/useCreateTeamAccess';"
    );
    expect(createTeam).toContain('params.fallback');
    expect(createTeam).toContain('organization_id?: string');
    expect(createTeam).toContain('const routeOrganizationId =');
    expect(createTeam).toContain("typeof params.organization_id === 'string'");
    expect(createTeam).toContain("pathname: '/organization'");
    expect(createTeam).toContain("tab: 'teams'");
    expect(createTeam).not.toContain("'/(tabs)/manage-teams'");
  });

  it('approvals wrapper auto-forwards directly when only one managed organization exists', () => {
    expect(approvals).toContain('entries.length !== 1');
    expect(approvals).toContain('router.replace(buildOrganizationRequestsRoute(entries[0].id))');
  });

  it('organization coach-request review returns to the canonical organization requests tab and uses coach-first copy', () => {
    expect(organizationJoinRequests).toContain("'/organization?tab=requests'");
    expect(organizationJoinRequests).toContain("title: 'Coach Requests'");
    expect(organizationJoinRequests).not.toContain("title: 'Team Join Requests'");
  });

  it('edit-team uses the scoped team admin summary instead of rebuilding access from org and roster fetches', () => {
    expect(editTeam).toContain('Team.adminSummary(params.id)');
    expect(editTeam).toContain("'/organization?tab=teams'");
    expect(editTeam).not.toContain('Team.members(params.id)');
    expect(editTeam).not.toContain('Organization.members(teamData.organization_id)');
  });

  it('my-team uses one focus loader and keeps member loading keyed to the selected team', () => {
    expect(myTeam.match(/useFocusEffect\(/g) || []).toHaveLength(1);
    // Team selection is resolved through the shared helper and applied via a
    // functional setState so `selectedTeamId` stays out of the effect deps.
    expect(myTeam).toContain(
      'setSelectedTeamId(prev => resolveNextSelectedTeamId(teams, routeTeamId, prev));'
    );
    // Member loading is keyed to the selected team via react-query, not an
    // imperative loadMembers call.
    expect(myTeam).toContain('useTeamMembersQuery({');
    expect(myTeam).toContain('teamId: selectedTeamId,');
  });

  it('manage-users stays coach-scoped and never falls back to the admin-only allMembers endpoint', () => {
    expect(manageUsers).toContain('Organization.reviewSummaries()');
    expect(manageUsers).toContain('orgSummaries) ? orgSummaries : []).map');
    expect(manageUsers).toContain('Organization.adminSummary(');
    expect(manageUsers).toContain('TeamApi.managed().catch(() => [])');
    expect(manageUsers).toContain('TeamApi.adminSummary(');
    expect(manageUsers).not.toContain('TeamApi.allMembers(');
  });

  it('org entry screens use the lighter review summary lookup when they only need a managed organization id/name', () => {
    expect(organizationScreen).toContain('Organization.reviewSummaries()');
    expect(step3League).toContain('Organization.reviewSummaries()');
    expect(mobileCommunity).toContain('Organization.reviewSummaries()');
  });

  it('discover coach quick actions preserve their origin and coach screens backtrack through tracked history', () => {
    expect(mobileCommunity).toContain("from: 'discover-quick-actions'");
    expect(mobileCommunity).toContain("pathname: '/manage-teams'");
    expect(mobileCommunity).toMatch(
      /pathname: '\/organization'[\s\S]{0,200}from: 'discover-quick-actions'/
    );
    expect(mobileCommunity).toContain("fallback: '/(tabs)/discover'");
    expect(mobileCommunity).toContain("pathname: '/event-approvals'");
    expect(organizationScreen).toContain(
      "params.from === 'discover-quick-actions' ? '/(tabs)/discover' : undefined"
    );
    expect(organizationScreen).toContain(
      'goBackToTrackedRoute(router, currentHref, navHistory?.getFallbackRoute?.(), backFallback)'
    );
    expect(manageTeams).toContain("params.from === 'discover-quick-actions'");
    expect(manageTeams).toContain("'/(tabs)/discover'");
    expect(manageSeason).toContain("params.from === 'discover-quick-actions'");
    expect(manageSeason).toContain(
      'goBackToTrackedRoute(router, currentHref, navHistory?.getFallbackRoute?.(), backFallback)'
    );
  });

  it('coach admin screens carry an explicit fallback contract instead of relying on stack luck', () => {
    expect(manageTeams).toContain('params.fallback');
    expect(manageTeams).toContain("'/organization?tab=teams'");
    expect(manageTeams).toContain("pathname: '/create-team'");
    expect(manageTeams).toContain('handleCreateTeamPress');
    expect(manageTeams).not.toContain("'/(tabs)/create-team'");
    expect(manageTeams).toContain("pathname: '/manage-season'");
    expect(manageTeams).toContain('activeTeams.length === 1 ? { teamId: activeTeams[0].id } : {}');
    expect(manageTeams).not.toContain('QuickAddGameModal');
    expect(manageTeams).not.toContain('QUICK ADD EVENT');
    expect(editOrganization).toContain('params.fallback');
    expect(editOrganization).toContain("'/organization?tab=overview'");
    expect(organizationScreen).toContain("pathname: '/edit-organization'");
    expect(organizationScreen).toContain('tab=overview');
    expect(manageSeason).toContain("pathname: '/create-team'");
    expect(manageSeason).not.toContain("void router.push('/create-team')");
    expect(manageSeason).toContain("backFallback ?? '/organization?tab=teams'");
  });

  it('coach access recovery prompts replace blocked screens instead of stacking onboarding or billing on top', () => {
    expect(coachAccess).toContain('replace: (href: any) => void;');
    expect(coachAccess).toContain("router.replace('/onboarding/coach-agreement')");
    expect(coachAccess).toContain('onPress: () => router.replace(recoveryRoute)');
    expect(coachAccess).toContain("router.replace('/settings/manage-subscription')");
    expect(coachAccess).not.toContain("router.push('/onboarding/coach-agreement')");
    expect(coachAccess).not.toContain('onPress: () => router.push(recoveryRoute)');
    expect(coachAccess).not.toContain("router.push('/settings/manage-subscription')");
  });

  it('event moderation and editing routes preserve a canonical return path', () => {
    expect(eventApprovals).toContain('params.fallback');
    expect(eventApprovals).toContain("params.from === 'discover-quick-actions'");
    expect(eventApprovals).toContain("'/(tabs)/discover'");
    expect(mobileCommunity).toContain("pathname: '/event-approvals'");
    expect(mobileCommunity).toContain("fallback: '/(tabs)/discover'");
    expect(editEvent).toContain('fallback');
    expect(editEvent).toContain("import { buildEventDetailHref } from '@/utils/eventRoutes';");
    expect(editEvent).toContain('buildEventDetailHref(String(id))');
    // event-detail.tsx is now a LEGACY REDIRECTOR (2026-07-05): the edit
    // affordance moved to the canonical game/public-event pages. It must never
    // dead-end — it forwards to /game/[id] or /public-event and offers a Go Back.
    expect(eventDetail).toContain('LEGACY REDIRECTOR');
    expect(eventDetail).toContain("pathname: '/game/[id]'");
    expect(eventDetail).toContain("safeGoBack(router, '/(tabs)/feed')");
  });

  it('organization members tooling exposes the authorized-user invite path and pending invite state', () => {
    expect(organizationScreen).toContain('Organization.invite(');
    expect(organizationScreen).toContain('Organization.cancelInvite(');
    expect(organizationScreen).toContain('pending_authorized_invites');
    expect(organizationScreen).toContain('authorized_invites');
  });

  it('organization owner approval cards route directly to org-specific coach request review', () => {
    expect(organizationScreen).toContain('buildOrganizationJoinRequestsRoute');
    expect(organizationScreen).toContain("pathname: '/organization-join-requests'");
    expect(organizationScreen).not.toContain("onPress={() => router.push('/approvals')}");
  });

  it('coach setup copy points users to live team/org management tools instead of a dead authorized-user onboarding step', () => {
    expect(step3League).toContain('invite managers and members from organization tools');
    expect(step3League).toContain('manage roster and staff invites from your team tools');
    expect(step3League).not.toContain('Continue to add authorized users and complete your setup.');
  });
});
