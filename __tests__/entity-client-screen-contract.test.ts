import fs from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

describe('entity client screen contract', () => {
  it('keeps organization screens on the shared Organization client', () => {
    const organizationsIndex = read('app', 'organizations', 'index.tsx');
    const organizationDetail = read('app', 'organizations', '[id].tsx');
    const leaguePendingApproval = read('app', 'onboarding', 'league-pending-approval.tsx');

    expect(organizationsIndex).toContain("import { Organization } from '@/api/entities';");
    expect(organizationsIndex).toContain('await Organization.list(undefined, 20)');
    expect(organizationsIndex).not.toContain('httpGet(`/organizations?limit=20`)');
    expect(organizationsIndex).not.toContain("httpGet('/organizations?limit=20')");

    expect(organizationDetail).toContain(
      "import { Organization as OrganizationApi } from '@/api/entities';"
    );
    expect(organizationDetail).toContain('await OrganizationApi.get(normalizedId)');
    expect(organizationDetail).not.toContain('httpGet(`/organizations/${normalizedId}`)');

    expect(leaguePendingApproval).toContain("Organization, User } from '@/api/entities';");
    expect(leaguePendingApproval).toContain('await Organization.get(orgId)');
    expect(leaguePendingApproval).not.toContain('httpGet(`/organizations/${orgId}`)');
  });

  it('keeps followed-team and my-events reads on shared entity helpers', () => {
    const followedTeams = read('app', 'settings', 'followed-teams.tsx');
    const createFanEvent = read('app', 'create-fan-event.tsx');
    const eventApprovals = read('app', '(tabs)', 'event-approvals.tsx');
    const subscriptionPaywall = read('app', 'subscription-paywall.tsx');
    const manageSubscription = read('app', 'settings', 'manage-subscription.tsx');
    const paymentSuccess = read('app', 'payment-success.tsx');
    const entities = read('api', 'entities.ts');

    expect(entities).toContain('mine: () =>');
    expect(entities).toContain(
      "httpGet('/events/my-events').then(data => validateEventSummaryArray('events.mine', data))"
    );
    expect(entities).toContain('followed: (): Promise<any> =>');
    expect(entities).toContain("httpGet('/follows/teams?user_id=me').then(data =>");

    // followed-teams now reads via react-query; the shared Team.followed() helper
    // is still the source (no raw httpGet), which is what this contract guards.
    expect(followedTeams).toContain('Team.followed() as Promise<FollowedTeam[]>');
    expect(followedTeams).not.toContain("httpGet('/follows/teams?user_id=me')");

    expect(createFanEvent).toContain('Event.mine()');
    expect(createFanEvent).toContain('const teams = await TeamAPI.followed()');
    expect(createFanEvent).not.toContain("httpGet('/events/my-events')");
    expect(createFanEvent).not.toContain("httpGet('/follows/teams?user_id=me')");

    expect(entities).toContain('pending: () =>');
    expect(entities).toContain("myJoinRequests: () => httpGet('/organizations/join-requests/me')");
    expect(entities).toContain('createPaymentSheet: (payload: {');
    expect(entities).toContain('cancelIntent: (paymentIntentId: string) =>');

    expect(eventApprovals).toContain(
      "import { Event, Game, Organization, Team } from '@/api/entities';"
    );
    expect(eventApprovals).toContain('Event.pending().catch(() => [])');
    expect(eventApprovals).toMatch(
      /Game\.list\(undefined, \{ approvalStatus: 'pending', limit: 50 \}\)\.catch\(\(\) => \(\{\s*games: \[\],\s*\}\)\)/
    );
    expect(eventApprovals).toContain('const data = await Team.myInvites()');
    expect(eventApprovals).toContain('const data = await Organization.myJoinRequests()');
    expect(eventApprovals).toContain('await Event.approve(eventId)');
    expect(eventApprovals).toContain(
      'await Event.reject(eventId, rejectReason.trim() || undefined)'
    );
    expect(eventApprovals).toContain("await Game.setApprovalStatus(eventId, 'approved')");
    expect(eventApprovals).toContain(
      "await Game.setApprovalStatus(eventId, 'rejected', rejectReason.trim() || undefined)"
    );
    expect(eventApprovals).toContain('await Team.acceptInvite(inviteId)');
    expect(eventApprovals).toContain('await Team.declineInvite(inviteId)');
    expect(eventApprovals).not.toContain("httpGet('/events/pending')");
    expect(eventApprovals).not.toContain("httpGet('/teams/invites/me')");
    expect(eventApprovals).not.toContain("httpGet('/organizations/join-requests/me')");

    expect(subscriptionPaywall).toContain('await Payments.createPaymentSheet({');
    expect(subscriptionPaywall).toContain(
      'Payments.cancelIntent(data.payment_intent_id).catch(() => {});'
    );
    expect(subscriptionPaywall).not.toContain("httpPost('/payments/create-payment-sheet'");
    expect(subscriptionPaywall).not.toContain("httpPost('/payments/cancel-intent'");

    expect(manageSubscription).toContain('await Payments.createPaymentSheet({');
    expect(manageSubscription).not.toContain("httpPost('/payments/create-payment-sheet'");

    expect(paymentSuccess).toContain('await Advertisement.get(adId)');
    expect(paymentSuccess).not.toContain('httpGet(`/ads/${adId}`)');
  });
});
