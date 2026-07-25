/**
 * "Select Your Team" must never be sourced from the PUBLIC team directory.
 *
 * `useTeamOptions` calls `Team.list()` — the unauthenticated discovery endpoint
 * that returns every team on VarsityHub. Both game modals used it to populate
 * the picker asking which of the user's OWN teams a game is for, so coaches
 * were shown hundreds of unrelated teams (Panama, Ghana, Argentina…) as if they
 * owned them.
 *
 * The scoped source is `useManagedTeamOptions` -> `Team.managed()` ->
 * `GET /teams/managed`, which mirrors `canManageAnyTeam` (org admins get their
 * organization's teams; coaches get the teams they are assigned to).
 *
 * The public hook is still legitimate for OPPONENT search — you pick opponents
 * from all of VarsityHub — so this contract asserts the modals import BOTH and
 * that the current-team list is derived from the managed one.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

const MODALS = ['components/QuickAddGameModal.tsx', 'components/AddGameModal.tsx'];

describe('team picker scope contract', () => {
  it.each(MODALS)('%s sources its own-team list from the managed hook', file => {
    const src = read(file);
    expect(src).toMatch(/useManagedTeamOptions/);
    // The own-team list must be built from the managed raw list.
    expect(src).toMatch(/myTeams[\s\S]{0,400}rawManagedTeams/);
  });

  it.each(MODALS)('%s still uses the public directory for opponents only', file => {
    const src = read(file);
    // Opponent search legitimately needs the public list — keep it.
    expect(src).toMatch(/useTeamOptions/);
  });

  it('the managed hook calls the scoped endpoint, not the public list', () => {
    const hook = read('hooks/useManagedTeamOptions.ts');
    expect(hook).toMatch(/Team\.managed\(/);
    expect(hook).not.toMatch(/Team\.list\(/);
  });

  it('the public hook remains the discovery/search source', () => {
    const hook = read('hooks/useTeamOptions.ts');
    expect(hook).toMatch(/Team\.list\(/);
  });
});
