import { describe, expect, it, jest } from '@jest/globals';
import { getViewerTeamScope } from '../lib/viewerTeamScope.js';

function makeDb(overrides: any = {}) {
  return {
    teamFollow: { findMany: jest.fn(async () => [{ team_id: 'followed-1' }]) },
    teamMembership: { findMany: jest.fn(async () => [{ team_id: 'staff-1' }]) },
    organizationMembership: { findMany: jest.fn(async () => [{ organization_id: 'org-1' }]) },
    team: { findMany: jest.fn(async () => [{ id: 'orgteam-1' }]) },
    ...overrides,
  } as any;
}

describe('getViewerTeamScope', () => {
  it('returns empty set for a null viewer without querying', async () => {
    const db = makeDb();
    const scope = await getViewerTeamScope(db, null);
    expect(scope.size).toBe(0);
    expect(db.teamFollow.findMany).not.toHaveBeenCalled();
  });

  it('unions followed, staff-managed, and org-admin teams', async () => {
    const scope = await getViewerTeamScope(makeDb(), 'viewer-1');
    expect([...scope].sort()).toEqual(['followed-1', 'orgteam-1', 'staff-1']);
  });

  it('skips the org-team query when the viewer administers no orgs', async () => {
    const db = makeDb({ organizationMembership: { findMany: jest.fn(async () => []) } });
    const scope = await getViewerTeamScope(db, 'viewer-1');
    expect(db.team.findMany).not.toHaveBeenCalled();
    expect([...scope].sort()).toEqual(['followed-1', 'staff-1']);
  });
});
