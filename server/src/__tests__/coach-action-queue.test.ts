import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

let prisma: any;
let buildCoachActionQueue: any;
const ts = Date.now();
let coachId = '', otherCoachId = '', orgId = '', teamId = '';

describe('coach action queue', () => {
  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ buildCoachActionQueue } = await import('../lib/coachActionQueue.js'));

    const mk = (label: string) =>
      prisma.user.create({
        data: {
          email: `caq-${label}-${ts}@example.com`, password_hash: 'x', display_name: label,
          email_verified: true, role: 'coach', onboarding_completed: true, approval_status: 'APPROVED',
          preferences: { role: 'coach' },
        },
      });
    coachId = (await mk('coach')).id;
    otherCoachId = (await mk('other')).id;

    const org = await prisma.organization.create({
      data: { name: `CAQ Org ${ts}`, org_type: 'club', admin_approved: true, updated_at: new Date(), league_owner_id: coachId },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({ data: { organization_id: org.id, user_id: coachId, role: 'owner', status: 'active' } });
    const team = await prisma.team.create({ data: { name: `CAQ Team ${ts}`, organization_id: org.id } });
    teamId = team.id;
    await prisma.teamMembership.create({ data: { team_id: team.id, user_id: coachId, role: 'coach', status: 'active' } });

    // A pending event on the coach's team.
    // NOTE: brief used `created_by`, but the real Event field is `creator_id` (see prisma/schema.prisma).
    await prisma.event.create({
      data: { title: `Pending Practice ${ts}`, team_id: team.id, approval_status: 'pending', date: new Date(), creator_id: otherCoachId } as any,
    });
  });

  afterAll(async () => {
    await prisma.game.deleteMany({ where: { OR: [{ home_team_id: teamId }, { away_team_id: teamId }] } }).catch(() => {});
    await prisma.event.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [coachId, otherCoachId] } } }).catch(() => {});
  });

  it('returns the coach\'s pending event as an action item', async () => {
    const q = await buildCoachActionQueue(coachId);
    expect(q.counts.events).toBe(1);
    const ev = q.items.find((i: any) => i.kind === 'event');
    expect(ev).toBeTruthy();
    expect(ev.team_id).toBe(teamId);
    expect(ev.route).toContain('/event-approvals');
    expect(q.total).toBe(q.items.length);
  });

  it('does NOT include another coach\'s items (scope isolation)', async () => {
    const q = await buildCoachActionQueue(otherCoachId);
    expect(q.counts.events).toBe(0);
    expect(q.total).toBe(0);
  });

  it('includes a pending game on the coach\'s team', async () => {
    const g = await prisma.game.create({
      data: { title: `Pending Game ${ts}`, home_team_id: teamId, approval_status: 'pending', date: new Date() } as any,
    });
    const q = await buildCoachActionQueue(coachId);
    expect(q.counts.games).toBeGreaterThanOrEqual(1);
    const item = q.items.find((i: any) => i.kind === 'game' && i.id === g.id);
    expect(item).toBeTruthy();
    expect(item.route).toBe(`/game/${g.id}`);
    await prisma.game.deleteMany({ where: { id: g.id } });
  });
});
