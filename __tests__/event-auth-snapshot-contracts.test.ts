import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const createScreen = read('app/create.tsx');
const createFanEventScreen = read('app/create-fan-event.tsx');
const eventDetailScreen = read('app/(tabs)/event-detail.tsx');

describe('event auth snapshot contracts', () => {
  it('create-fan-event derives current user from the shared auth snapshot helper', () => {
    // create.tsx is now a thin hub (useCreateTeamAccess) with no user fetch.
    expect(createScreen).not.toContain('User.me()');
    for (const screen of [createFanEventScreen]) {
      expect(screen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
      expect(screen).toContain('const { user, checkAuth } = useAuth();');
      expect(screen).toContain('getAuthSnapshot(checkAuth, user)');
      expect(screen).not.toContain('await User.me()');
    }
  });

  it('event-detail is a legacy redirector that forwards to canonical event pages', () => {
    // As of 2026-07-05 event-detail.tsx is a pure redirector: it resolves the
    // event id and forwards game-linked events to /game/[id] and standalone
    // events to /public-event. It renders no event UI, so it never resolves
    // viewer identity — the surviving invariant is "no ad-hoc User.me() refetch."
    expect(eventDetailScreen).toContain('LEGACY REDIRECTOR');
    expect(eventDetailScreen).toContain("pathname: '/game/[id]'");
    expect(eventDetailScreen).toContain('pathname: PUBLIC_EVENT_PATHNAME');
    expect(eventDetailScreen).not.toContain('User.me()');
  });
});
