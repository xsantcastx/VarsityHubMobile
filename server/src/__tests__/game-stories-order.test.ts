/**
 * Story replay order (owner report, Fanatics Fest 2026-07-16): "the order for
 * stories right now is latest to earliest post, it should be from earliest to
 * latest post. So it's actually going from the beginning to the end of the day."
 *
 * GET /games/:id/media and GET /games/:id/stories share makeListMediaHandler,
 * and the client's stories rail + StoriesViewer consume that one array (the
 * viewer indexes into it by position). So order is fixed once, here, at the
 * query layer — a render-layer reverse in the rail would desync the viewer.
 *
 * The `take` still runs newest-first so a game with more than 50 stories
 * returns the most recent 50 rather than the oldest 50; only the returned page
 * is replayed chronologically.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { makeListMediaHandler } from '../routes/games.js';

const day = (hour: number) => new Date(`2026-07-16T${String(hour).padStart(2, '0')}:00:00.000Z`);

// Newest-first, as the DB returns for `orderBy: { created_at: 'desc' }`.
const storyRows = [
  { id: 'evening', media_url: 'https://cdn.example.com/c.jpg', created_at: day(21) },
  { id: 'afternoon', media_url: 'https://cdn.example.com/b.jpg', created_at: day(17) },
  { id: 'morning', media_url: 'https://cdn.example.com/a.jpg', created_at: day(9) },
].map(r => ({ ...r, caption: null, user_id: 'u1', expires_at: null }));

const makeStubPrisma = (rows: any[]) => ({
  game: {
    findUnique: jest.fn(async () => ({
      id: 'g1',
      approval_status: 'approved',
      opponent_approval_status: 'not_required',
      date: day(12),
      created_by_id: 'u1',
      home_team_id: 't1',
      away_team_id: 't2',
    })),
  },
  story: {
    // First call is the lazy expired-cleanup sweep; the second is the page.
    findMany: jest
      .fn()
      .mockImplementationOnce(async () => [])
      .mockImplementationOnce(async () => rows.slice()),
    deleteMany: jest.fn(async () => ({ count: 0 })),
  },
});

const runHandler = async (prismaStub: any) => {
  const json = jest.fn();
  const res: any = { json, status: jest.fn(() => res) };
  const req: any = { params: { id: 'g1' }, user: null, headers: {}, query: {} };
  const next = jest.fn();
  const handler = makeListMediaHandler({ prisma: prismaStub as any });
  // asyncHandler returns void and runs the handler on the microtask queue —
  // yield to the event loop so it settles before asserting.
  handler(req, res, next);
  await new Promise(resolve => setImmediate(resolve));
  if (next.mock.calls.length) throw next.mock.calls[0][0] as Error;
  return json.mock.calls[0]?.[0] as any[];
};

describe('game stories list order', () => {
  it('replays stories oldest-first, from the beginning of the day to the end', async () => {
    const payload = await runHandler(makeStubPrisma(storyRows));

    expect(payload.map(m => m.id)).toEqual(['morning', 'afternoon', 'evening']);
  });

  it('returns created_at in ascending order', async () => {
    const payload = await runHandler(makeStubPrisma(storyRows));

    const timestamps = payload.map(m => new Date(m.created_at).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it('still asks the DB for the newest window, so >50 stories keeps recent ones', async () => {
    const prismaStub = makeStubPrisma(storyRows);
    await runHandler(prismaStub);

    // Second findMany is the page query (the first is the expiry sweep).
    const pageQuery = (prismaStub.story.findMany as any).mock.calls[1][0];
    expect(pageQuery.orderBy).toEqual({ created_at: 'desc' });
    expect(pageQuery.take).toBe(50);
  });
});
