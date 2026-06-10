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
