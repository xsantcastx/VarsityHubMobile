import {
  applyClearVote,
  applyVoteSelection,
  buildVoteSummary,
  parseVoteSummary,
} from '@/utils/voteSummary';

describe('voteSummary helpers', () => {
  it('buildVoteSummary clamps negatives and computes percentages', () => {
    const summary = buildVoteSummary(-2, 2, 'A');
    expect(summary.teamA).toBe(0);
    expect(summary.teamB).toBe(2);
    expect(summary.total).toBe(2);
    expect(summary.pctA).toBe(0);
    expect(summary.pctB).toBe(100);
    expect(summary.userVote).toBe('A');
  });

  it('buildVoteSummary handles empty totals', () => {
    const summary = buildVoteSummary(0, 0, null);
    expect(summary.total).toBe(0);
    expect(summary.pctA).toBe(0);
    expect(summary.pctB).toBe(0);
  });

  it('parseVoteSummary normalizes invalid payloads', () => {
    const summary = parseVoteSummary({ teamA: 3, teamB: 1, userVote: 'C' });
    expect(summary.teamA).toBe(3);
    expect(summary.teamB).toBe(1);
    expect(summary.total).toBe(4);
    expect(summary.pctA).toBe(75);
    expect(summary.pctB).toBe(25);
    expect(summary.userVote).toBe(null);
  });

  it('applyVoteSelection adds a new vote and switches sides', () => {
    const first = applyVoteSelection(null, 'A');
    expect(first.teamA).toBe(1);
    expect(first.teamB).toBe(0);
    expect(first.userVote).toBe('A');

    const switched = applyVoteSelection(first, 'B');
    expect(switched.teamA).toBe(0);
    expect(switched.teamB).toBe(1);
    expect(switched.userVote).toBe('B');
  });

  it('applyVoteSelection is a no-op when selecting the same team', () => {
    const summary = buildVoteSummary(2, 1, 'A');
    const next = applyVoteSelection(summary, 'A');
    expect(next).toEqual(summary);
  });

  it('applyClearVote removes a user vote and protects against negatives', () => {
    const summary = buildVoteSummary(0, 1, 'B');
    const cleared = applyClearVote(summary);
    expect(cleared?.teamA).toBe(0);
    expect(cleared?.teamB).toBe(0);
    expect(cleared?.userVote).toBe(null);
  });

  it('applyClearVote returns the original summary when no user vote exists', () => {
    const summary = buildVoteSummary(1, 2, null);
    const cleared = applyClearVote(summary);
    expect(cleared).toBe(summary);
  });
});
