import { buildScheduleItems } from '../lib/teamScheduleFeed.js';

const PAST = new Date(Date.now() - 86_400_000).toISOString();
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

describe('buildScheduleItems', () => {
  it('includes an approved game with a consenting opponent', () => {
    const items = buildScheduleItems(
      [
        {
          id: 'g1',
          date: FUTURE,
          approval_status: 'approved',
          opponent_approval_status: 'approved',
        },
      ],
      []
    );
    expect(items.map(i => i.id)).toEqual(['g1']);
    expect(items[0].kind).toBe('game');
  });

  it('hides an UPCOMING game whose opponent has not consented', () => {
    const items = buildScheduleItems(
      [
        {
          id: 'g2',
          date: FUTURE,
          approval_status: 'approved',
          opponent_approval_status: 'pending',
        },
      ],
      []
    );
    expect(items).toEqual([]);
  });

  it('shows a PAST game even if the opponent never consented (canonical rule / #3)', () => {
    const items = buildScheduleItems(
      [{ id: 'g3', date: PAST, approval_status: 'approved', opponent_approval_status: 'declined' }],
      []
    );
    expect(items.map(i => i.id)).toEqual(['g3']);
  });

  it('includes a standalone event and tags it kind:event (#1)', () => {
    const items = buildScheduleItems(
      [],
      [{ id: 'e1', title: 'Practice', date: FUTURE, event_type: 'practice' }]
    );
    expect(items[0]).toMatchObject({ kind: 'event', id: 'e1', title: 'Practice' });
  });

  it('sorts games and events together by date, most recent first', () => {
    const items = buildScheduleItems(
      [
        {
          id: 'g',
          date: PAST,
          approval_status: 'approved',
          opponent_approval_status: 'not_required',
        },
      ],
      [{ id: 'e', title: 'x', date: FUTURE, event_type: 'bbq' }]
    );
    expect(items.map(i => i.id)).toEqual(['e', 'g']); // future before past
  });
});
