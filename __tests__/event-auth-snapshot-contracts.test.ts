import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const createScreen = read('app/create.tsx');
const createFanEventScreen = read('app/create-fan-event.tsx');
const eventDetailScreen = read('app/(tabs)/event-detail.tsx');

describe('event auth snapshot contracts', () => {
  it('create and create-fan-event derive current user from the shared auth snapshot helper', () => {
    for (const screen of [createScreen, createFanEventScreen]) {
      expect(screen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
      expect(screen).toContain('const { user, checkAuth } = useAuth();');
      expect(screen).toContain('getAuthSnapshot(checkAuth, user)');
      expect(screen).not.toContain('await User.me()');
    }
  });

  it('event-detail resolves viewer state through the shared auth snapshot helper', () => {
    expect(eventDetailScreen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(eventDetailScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(eventDetailScreen).toContain('getAuthSnapshot(checkAuth, user).catch(() => null)');
    expect(eventDetailScreen).not.toContain('User.me().catch(() => null)');
  });
});
