/**
 * Deleting your OWN content is a data right, not a gated "feature".
 *
 * DELETE /posts/:id used to sit behind `requireOnboarded`, which returns 403 for:
 *   - a coach whose approval_status is PENDING or REJECTED  (requireOnboarded.ts:134)
 *   - a coach whose accepted agreement version is stale      (requireOnboarded.ts:144)
 *   - any user whose onboarding_completed flag has drifted   (requireOnboarded.ts:127)
 *
 * Those users could delete their own COMMENT (that route carries only requireAuth)
 * but not their own POST. That was an inconsistency, not a policy — and it is
 * exactly the class of bug where a user is locked out of removing their own content.
 *
 * Authorization is still fully enforced inside the handler (author OR team coach OR
 * admin, posts.ts). This test pins the middleware stack so the gate cannot creep back.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src', 'routes', 'posts.ts'), 'utf8');

/**
 * Extract the middleware list between `postsRouter.delete(` and its `asyncHandler(`,
 * with `//` comments stripped — the route carries an explanatory comment that
 * mentions requireOnboarded by name, and we assert on real middleware, not prose.
 */
function guardsFor(routePath: string): string {
  const start = source.indexOf(`postsRouter.delete(\n  '${routePath}',`);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('asyncHandler(', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end).replace(/\/\/.*$/gm, '');
}

describe('post deletion authorization contract', () => {
  it('DELETE /posts/:id is NOT gated behind requireOnboarded', () => {
    const guards = guardsFor('/:id');
    expect(guards).toContain('requireAuth');
    expect(guards).not.toContain('requireOnboarded');
  });

  it('deleting your own comment stays ungated too (parity with post delete)', () => {
    const guards = guardsFor('/:postId/comments/:commentId');
    expect(guards).toContain('requireAuth');
    expect(guards).not.toContain('requireOnboarded');
  });

  it('post CREATION is still gated behind requireOnboarded', () => {
    // The gate belongs on content creation, not deletion.
    expect(source).toContain('requireOnboarded');
    const createStart = source.indexOf("postsRouter.post(\n  '/',");
    expect(createStart).toBeGreaterThan(-1);
    const createEnd = source.indexOf('asyncHandler(', createStart);
    expect(source.slice(createStart, createEnd)).toContain('requireOnboarded');
  });

  it('ownership is still enforced in the delete handler', () => {
    expect(source).toContain('const isAuthor = post.author_id === userId;');
    expect(source).toContain('if (!isAuthor && !isTeamCoach && !isAdminUser)');
  });
});
