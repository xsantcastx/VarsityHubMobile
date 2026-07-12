import { prisma } from './prisma.js';
import { TEAM_STAFF_ROLES } from './teamAuthorization.js';

export type ActionKind = 'event' | 'game' | 'request';
export interface ActionItem {
  kind: ActionKind;
  id: string;
  title: string;
  subtitle: string;
  team_id?: string | null;
  org_id?: string | null;
  created_at: string;
  route: string;
}
export interface ActionQueue {
  total: number;
  counts: { events: number; games: number; requests: number };
  items: ActionItem[];
}

const SOURCE_TAKE = 50;

// Teams the user can manage (direct staff role) PLUS every active team inside an
// org they own — resolved server-side, never from client input.
export async function getCoachManagedScope(
  userId: string
): Promise<{ teamIds: string[]; ownedOrgIds: string[] }> {
  const [staff, owned] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { user_id: userId, role: { in: [...TEAM_STAFF_ROLES] }, status: 'active' },
      select: { team_id: true },
      take: 5000,
    }),
    prisma.organizationMembership.findMany({
      where: { user_id: userId, role: 'owner', status: 'active' },
      select: { organization_id: true },
      take: 5000,
    }),
  ]);
  const ownedOrgIds = owned.map((o) => o.organization_id);
  const orgTeams = ownedOrgIds.length
    ? await prisma.team.findMany({
        where: { organization_id: { in: ownedOrgIds }, status: 'active' },
        select: { id: true },
        take: 5000,
      })
    : [];
  const teamIds = [...new Set([...staff.map((m) => m.team_id), ...orgTeams.map((t) => t.id)])];
  return { teamIds, ownedOrgIds };
}

export async function buildCoachActionQueue(userId: string): Promise<ActionQueue> {
  const { teamIds, ownedOrgIds } = await getCoachManagedScope(userId);

  const events = teamIds.length
    ? await prisma.event.findMany({
        where: { approval_status: 'pending', team_id: { in: teamIds } },
        select: { id: true, title: true, date: true, location: true, team_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: SOURCE_TAKE,
      })
    : [];

  const games = teamIds.length
    ? await prisma.game.findMany({
        where: {
          approval_status: 'pending',
          OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
        },
        select: { id: true, title: true, date: true, location: true, home_team_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: SOURCE_TAKE,
      })
    : [];

  const requests = ownedOrgIds.length
    ? await prisma.organizationJoinRequest.findMany({
        where: { organization_id: { in: ownedOrgIds }, status: 'pending' },
        select: { id: true, organization_id: true, user_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
        take: SOURCE_TAKE,
      })
    : [];

  const items: ActionItem[] = events.map((e) => ({
    kind: 'event' as const,
    id: e.id,
    title: e.title || 'Event',
    subtitle: e.location || (e.date ? new Date(e.date).toLocaleDateString() : 'Pending approval'),
    team_id: e.team_id,
    created_at: (e.created_at ?? new Date()).toISOString(),
    route: `/event-approvals?teamId=${encodeURIComponent(e.team_id ?? '')}`,
  }));

  items.push(
    ...games.map((g) => ({
      kind: 'game' as const,
      id: g.id,
      title: g.title || 'Game',
      subtitle: g.location || (g.date ? new Date(g.date).toLocaleDateString() : 'Pending approval'),
      team_id: g.home_team_id,
      created_at: (g.created_at ?? new Date()).toISOString(),
      route: `/game/${g.id}`,
    }))
  );

  items.push(
    ...requests.map((r) => ({
      kind: 'request' as const,
      id: r.id,
      title: 'Join request',
      subtitle: 'Someone wants to join your organization',
      org_id: r.organization_id,
      created_at: (r.created_at ?? new Date()).toISOString(),
      route: `/organization-join-requests?id=${encodeURIComponent(r.organization_id)}`,
    }))
  );

  items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    total: items.length,
    counts: { events: events.length, games: games.length, requests: requests.length },
    items,
  };
}
