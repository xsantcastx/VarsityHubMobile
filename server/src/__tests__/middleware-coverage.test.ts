/**
 * Regression test: critical-route middleware coverage
 *
 * Why this exists:
 *   - `POST /teams/:id/transfer-ownership` was missing `requireVerified` while
 *     every other team mutation required it. Unverified emails could transfer
 *     team ownership. Caught by audit, fixed.
 *   - CLAUDE.md: "ALL routes accessing `req.user` MUST have `requireAuth`
 *     middleware." That rule was informal — this test makes it enforced.
 *
 * Approach:
 *   Static source-check of the route files. For each high-value mutation
 *   route, we assert the registration line contains the expected middleware
 *   names. This is the simplest check that catches the exact drift class
 *   without needing a DB or supertest rig.
 *
 *   If the registration style ever changes dramatically, the regex will
 *   need updating — that's fine, this is a LINT-shaped test, not a behavior test.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes');

type Expectation = {
  file: string;
  /** Human-readable route description for test names. */
  description: string;
  /** Regex that must match a single `.post/.put/.patch/.delete(...)` line. */
  registrationPattern: RegExp;
  /** Middleware names that must all appear between the path and the handler. */
  mustInclude: string[];
};

/**
 * The registration line we're matching looks like:
 *   teamsRouter.post('/:id/transfer-ownership', requireAuth as any, requireVerified as any, requireOnboarded as any, asyncHandler(...
 * We grab the full line starting at the method call up to the handler so we
 * can substring-search for middleware names on it.
 */
const extractRegistrationLine = (source: string, pattern: RegExp): string | null => {
  const match = source.match(pattern);
  if (!match) return null;
  // Expand to the whole logical line up to the first asyncHandler(/asHandler or to the closing paren.
  const start = match.index ?? 0;
  const tail = source.slice(start);
  // Take up through the first "asyncHandler(" or "async (" since that's where the handler begins.
  const handlerMatch = tail.match(/asyncHandler\s*\(|async\s*\(/);
  const end = handlerMatch ? (handlerMatch.index ?? tail.length) : tail.length;
  return tail.slice(0, end);
};

const EXPECTATIONS: Expectation[] = [
  // v1.0.3: transfer-ownership was missing requireVerified. Locked down now.
  {
    file: 'teams.ts',
    description: 'POST /teams/:id/transfer-ownership',
    registrationPattern: /teamsRouter\.post\(\s*['"]\/:id\/transfer-ownership['"]/,
    mustInclude: ['requireAuth', 'requireVerified', 'requireOnboarded'],
  },
  // Mirror of transfer-ownership on the org side — confirms parity is enforced here too.
  {
    file: 'organizations.ts',
    description: 'POST /organizations/:id/transfer-ownership',
    registrationPattern: /organizationsRouter\.post\(\s*['"]\/:id\/transfer-ownership['"]/,
    mustInclude: ['requireAuth', 'requireVerified', 'requireOnboarded'],
  },
  // Org creation — the route the onboarding bypass was added to. Still requires full chain.
  {
    file: 'organizations.ts',
    description: 'POST /organizations/',
    registrationPattern: /organizationsRouter\.post\(\s*['"]\/['"]/,
    mustInclude: ['requireAuth', 'requireVerified', 'requireOnboarded'],
  },
  // Team creation — paid-gate matters here too. requirePlan must be on the chain.
  {
    file: 'teams.ts',
    description: 'POST /teams/',
    registrationPattern: /teamsRouter\.post\(\s*['"]\/['"]/,
    mustInclude: ['requireVerified', 'requireOnboarded', 'requirePlan'],
  },
  // Team invite — has its own rate limiter in addition to the core chain.
  {
    file: 'teams.ts',
    description: 'POST /teams/:id/invite',
    registrationPattern: /teamsRouter\.post\(\s*['"]\/:id\/invite['"]/,
    mustInclude: ['requireAuth', 'requireVerified', 'requireOnboarded', 'inviteLimiter'],
  },
  {
    file: 'teams.ts',
    description: 'GET /teams/invites/me',
    registrationPattern: /teamsRouter\.get\(\s*['"]\/invites\/me['"]/,
    mustInclude: ['requireAuth', 'requireVerified'],
  },
  {
    file: 'teams.ts',
    description: 'POST /teams/invites/:inviteId/accept',
    registrationPattern: /teamsRouter\.post\(\s*['"]\/invites\/:inviteId\/accept['"]/,
    mustInclude: ['requireAuth', 'requireVerified'],
  },
  {
    file: 'teams.ts',
    description: 'POST /teams/invites/:inviteId/decline',
    registrationPattern: /teamsRouter\.post\(\s*['"]\/invites\/:inviteId\/decline['"]/,
    mustInclude: ['requireAuth', 'requireVerified'],
  },
  {
    file: 'organizations.ts',
    description: 'GET /organizations/invites/me',
    registrationPattern: /organizationsRouter\.get\(\s*['"]\/invites\/me['"]/,
    mustInclude: ['requireAuth', 'requireVerified'],
  },
  {
    file: 'organizations.ts',
    description: 'POST /organizations/invites/:inviteId/accept',
    registrationPattern: /organizationsRouter\.post\(\s*['"]\/invites\/:inviteId\/accept['"]/,
    mustInclude: ['requireAuth', 'requireVerified'],
  },
  {
    file: 'organizations.ts',
    description: 'POST /organizations/invites/:inviteId/decline',
    registrationPattern: /organizationsRouter\.post\(\s*['"]\/invites\/:inviteId\/decline['"]/,
    mustInclude: ['requireAuth', 'requireVerified'],
  },
];

describe('Middleware coverage on critical mutation routes', () => {
  it.each(EXPECTATIONS)(
    '$description declares [$mustInclude]',
    ({ file, registrationPattern, mustInclude }) => {
      const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
      const line = extractRegistrationLine(source, registrationPattern);
      expect(line).not.toBeNull();
      const actualLine = line ?? '';
      for (const middleware of mustInclude) {
        expect(actualLine).toMatch(new RegExp(`\\b${middleware}\\b`));
      }
    },
  );

  it('requireAuth is imported in every route file that uses req.user', () => {
    // Belt-and-braces per CLAUDE.md rule: "ALL routes accessing req.user MUST
    // have requireAuth middleware." Weak but cheap signal — if a route file
    // references req.user but has no requireAuth import, it's suspicious.
    const routeFiles = [
      'teams.ts',
      'organizations.ts',
      'posts.ts',
      'events.ts',
      'messages.ts',
      'notifications.ts',
      'ads.ts',
      'users.ts',
      'games.ts',
    ];
    const offenders: string[] = [];
    for (const file of routeFiles) {
      const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
      const usesReqUser = /\breq\.user\b/.test(source);
      const importsRequireAuth =
        /from\s+['"][^'"]*middleware\/requireAuth/.test(source) ||
        /from\s+['"][^'"]*middleware\/auth/.test(source);
      if (usesReqUser && !importsRequireAuth) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
