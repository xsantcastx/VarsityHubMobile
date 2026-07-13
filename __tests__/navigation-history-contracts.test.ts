import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const navigationUtils = read('utils/navigation.ts');
const navigationHistory = read('context/NavigationHistoryContext.tsx');
const edgeSwipeBack = read('hooks/useEdgeSwipeBack.ts');
const teamPage = read('app/team-page.tsx');
const authTelemetry = read('utils/authTelemetry.ts');

describe('navigation history contracts', () => {
  it('safeGoBack delegates empty-stack handling to tracked history before global fallbacks', () => {
    expect(navigationUtils).toContain('performTrackedSafeBack');
    expect(navigationUtils).toContain('if (performTrackedSafeBack(explicitFallback))');
    expect(navigationHistory).toContain('let globalSafeBack');
    expect(navigationHistory).toContain('let globalMarkNextHistoryEntryAsRedirect');
    expect(navigationHistory).toContain('export function performTrackedSafeBack');
    expect(navigationHistory).toContain('export function markNextHistoryEntryAsRedirect()');
    expect(navigationHistory).toContain('setNavigationSafeBackHandler(safeGoBack);');
  });

  it('auth redirects mark the next history entry as redirect-only before replace()', () => {
    expect(authTelemetry).toContain('markNextHistoryEntryAsRedirect');
    expect(authTelemetry).toContain('markNextHistoryEntryAsRedirect();');
    expect(authTelemetry).toContain('router.replace(payload.to as any);');
  });

  it('edge swipe back uses the shared tracked-history safe-back path', () => {
    expect(edgeSwipeBack).toContain('if (navHistory?.safeGoBack)');
    expect(edgeSwipeBack).toContain('navHistory.safeGoBack();');
    expect(edgeSwipeBack).not.toContain('router.back();\n    } else {');
  });

  it('coach-tools back buttons use safeGoBack — goBackToTrackedRoute is retired', () => {
    // goBackToTrackedRoute preferred a peeked (never popped) history entry
    // over the native stack and recorded its own back as a forward move —
    // the root cause of the org/manage-season back-button loop.
    const organization = read('app/(tabs)/organization.tsx');
    const manageSeason = read('app/manage-season.tsx');
    expect(navigationUtils).not.toContain('goBackToTrackedRoute');
    expect(organization).not.toContain('goBackToTrackedRoute');
    expect(manageSeason).not.toContain('goBackToTrackedRoute');
    expect(organization).toContain('safeGoBack(router');
    expect(manageSeason).toContain('safeGoBack(router');
  });

  it('auto-redirects replace via replaceAsRedirect so they never become back targets', () => {
    const approvals = read('app/(tabs)/approvals.tsx');
    const requireCoach = read('hooks/useRequireCoach.ts');
    const requireTeamManagement = read('hooks/useRequireTeamManagement.ts');
    expect(navigationUtils).toContain('export function replaceAsRedirect');
    expect(teamPage).toContain('replaceAsRedirect(router, ');
    expect(approvals).toContain('replaceAsRedirect(router, ');
    expect(requireCoach).toContain('replaceAsRedirect(router, ');
    expect(requireTeamManagement).toContain('replaceAsRedirect(router, ');
  });

  it('native back pops mark themselves so the screen being left is not recorded as a forward visit', () => {
    expect(navigationUtils).toMatch(/markNextHistoryEntryAsRedirect\(\);\s*\n\s*router\.back\(\);/);
    expect(navigationHistory).toMatch(
      /isNavigatingBackRef\.current = true;\s*\n\s*router\.back\(\);/
    );
  });

  it('org team rows route program teams to the program page — no redirect hop', () => {
    const organization = read('app/(tabs)/organization.tsx');
    expect(organization).toMatch(/program_id[\s\S]{0,300}\/program-page/);
  });

  it('program page has no public team-page link; staff surfaces pass the from=program bypass', () => {
    // Level teams have no public page — the program page is the only public
    // surface. Staff/admin surfaces still open team pages deliberately, so
    // they carry from=program to bypass the canonical redirect.
    const programPage = read('app/program-page.tsx');
    expect(programPage).not.toContain('/team-page');
    for (const rel of [
      'app/(tabs)/manage-teams.tsx',
      'app/(tabs)/create-team.tsx',
      'app/admin-teams.tsx',
      'app/team-invites.tsx',
    ]) {
      const src = read(rel);
      // Window-based (not line-based): push calls may be formatted multi-line,
      // with params on the following line.
      const occurrences = [...src.matchAll(/team-page/g)];
      expect(occurrences.length).toBeGreaterThan(0);
      for (const m of occurrences) {
        const windowText = src.slice(m.index!, m.index! + 160);
        expect(windowText).toMatch(/from=program|from: 'program'/);
      }
    }
  });

  it('team page return-to-game flow uses shared safeGoBack with a typed route fallback', () => {
    expect(teamPage).toContain(
      "safeGoBack(router, { pathname: '/game/[id]', params: { id: gameId } } as any);"
    );
    expect(teamPage).not.toContain('navigation.canGoBack()');
    expect(teamPage).not.toContain(
      "router.push({ pathname: '/game/[id]', params: { id: gameId } } as any);"
    );
  });
});
