/**
 * Phase 0 authority: deriveGameApproval is the SINGLE source of truth for a
 * game's approval_status + opponent-approval fields. Every game-write path
 * (POST /games, POST /games/bulk, PUT /games/:id) must call it so the
 * approval/opponent-consent decision cannot drift between siblings.
 *
 * The 2026-07-14 audit found POST /games/bulk hardcoded approval_status:'approved'
 * for every row once the caller managed ANY one team in the batch, and PUT /games/:id
 * reassigned teams without recomputing opponent approval. This authority + its
 * parity contract (see game-write-approval-parity.test.ts) close that class.
 *
 * canManage is injected so the decision is tested as real behavior, no DB.
 */

import { describe, expect, it } from '@jest/globals';
import { deriveGameApproval } from '../lib/gameApproval.js';

const manages =
  (...teamIds: string[]) =>
  async (_userId: string, teamId: string) =>
    teamIds.includes(teamId);

const managesNone = async () => false;

describe('deriveGameApproval — approval_status', () => {
  it('approves when the caller manages the home team', async () => {
    const d = await deriveGameApproval('u1', 'home', 'away', false, manages('home'));
    expect(d.isCoach).toBe(true);
    expect(d.managedTeamId).toBe('home');
    expect(d.approvalStatus).toBe('approved');
  });

  it('approves when the caller manages the away team', async () => {
    const d = await deriveGameApproval('u1', 'home', 'away', false, manages('away'));
    expect(d.managedTeamId).toBe('away');
    expect(d.approvalStatus).toBe('approved');
  });

  it('leaves a game PENDING when the caller manages NEITHER team (the bulk-injection bug)', async () => {
    const d = await deriveGameApproval('u1', 'victimHome', 'victimAway', false, managesNone);
    expect(d.isCoach).toBe(false);
    expect(d.managedTeamId).toBeNull();
    expect(d.approvalStatus).toBe('pending');
  });

  it('auto-approves for a platform admin regardless of team management', async () => {
    const d = await deriveGameApproval('admin', 'anyHome', 'anyAway', true, managesNone);
    expect(d.isCoach).toBe(true);
    expect(d.approvalStatus).toBe('approved');
  });
});

describe('deriveGameApproval — opponent consent', () => {
  it('requires opponent approval when the caller manages only their own side', async () => {
    const d = await deriveGameApproval('u1', 'mine', 'theirs', false, manages('mine'));
    expect(d.opponentApprovalTeamId).toBe('theirs');
    expect(d.opponentApprovalStatus).toBe('pending');
  });

  it('does not require opponent approval when the caller manages both sides', async () => {
    const d = await deriveGameApproval('u1', 'a', 'b', false, manages('a', 'b'));
    expect(d.opponentApprovalTeamId).toBeNull();
    expect(d.opponentApprovalStatus).toBe('not_required');
  });

  it('does not require opponent approval for a free-text opponent (no away_team_id)', async () => {
    const d = await deriveGameApproval('u1', 'mine', null, false, manages('mine'));
    expect(d.opponentApprovalTeamId).toBeNull();
    expect(d.opponentApprovalStatus).toBe('not_required');
  });

  it('never requires opponent approval for an admin-created game', async () => {
    const d = await deriveGameApproval('admin', 'a', 'b', true, managesNone);
    expect(d.opponentApprovalTeamId).toBeNull();
    expect(d.opponentApprovalStatus).toBe('not_required');
  });

  it('does not self-flag when the managed team equals the opponent id', async () => {
    const d = await deriveGameApproval('u1', 'same', 'same', false, manages('same'));
    expect(d.opponentApprovalTeamId).toBeNull();
    expect(d.opponentApprovalStatus).toBe('not_required');
  });
});
