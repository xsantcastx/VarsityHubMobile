import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const createTeamScreen = read('app/(tabs)/create-team.tsx');
const manageTeamsScreen = read('app/(tabs)/manage-teams.tsx');

describe('team auth snapshot contracts', () => {
  it('create-team resolves coach state through the shared auth snapshot helper', () => {
    expect(createTeamScreen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(createTeamScreen).toContain('const { user: authUser, checkAuth } = useAuth();');
    expect(createTeamScreen).toContain('await getAuthSnapshot(checkAuth, authUser)');
    expect(createTeamScreen).not.toContain('await User.me()');
  });

  it('manage-teams resolves payment state through the shared auth snapshot helper', () => {
    expect(manageTeamsScreen).toContain("import { getAuthSnapshot } from '@/utils/authState';");
    expect(manageTeamsScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(manageTeamsScreen).toContain('await getAuthSnapshot(checkAuth, user)');
    expect(manageTeamsScreen).not.toContain('await User.me()');
  });
});
