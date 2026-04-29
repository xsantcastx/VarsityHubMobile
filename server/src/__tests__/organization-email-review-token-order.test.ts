import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'routes', 'organizations.ts'), 'utf8');

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  return src.slice(start, end);
}

describe('organization email review token order', () => {
  it('consumes coach join request tokens only after a successful email review action', () => {
    const slice = sliceBetween(
      'async function joinRequestEmailReviewHandler',
      "organizationsRouter.get('/join-requests/:requestId/email/approve'"
    );
    expect(slice.indexOf('const result =')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result =')
    );
  });

  it('renders precise join-request state pages and action-specific invalid-link copy', () => {
    const slice = sliceBetween(
      'async function joinRequestEmailReviewHandler',
      "organizationsRouter.get('/join-requests/:requestId/email/approve'"
    );
    expect(src).toContain('function renderJoinRequestStatePage(');
    expect(slice).toContain("const linkLabel = action === 'approve' ? 'approval' : 'rejection'");
    expect(slice).toContain('This ${linkLabel} link is missing or invalid.');
    expect(slice).toContain('This ${linkLabel} link is no longer valid.');
    expect(slice).toContain('return res.send(renderJoinRequestStatePage(joinRequest, action));');
  });

  it('consumes league approval tokens only after approveOrganization completes', () => {
    const slice = sliceBetween(
      'async function approveLeagueHandler',
      "organizationsRouter.get('/:id/reject'"
    );
    expect(slice.indexOf('const result = await approveOrganization')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result = await approveOrganization')
    );
  });

  it('consumes league rejection tokens only after rejectOrganization completes', () => {
    const slice = sliceBetween(
      'async function rejectLeagueHandler',
      '// Legacy path used by the mobile app'
    );
    expect(slice.indexOf('const result = await rejectOrganization')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result = await rejectOrganization')
    );
  });
});
