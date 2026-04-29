import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'routes', 'ads.ts'), 'utf8');

function getFunctionSlice(name: string, nextMarker: string): string {
  const start = src.indexOf(name);
  const end = src.indexOf(nextMarker, start);
  return src.slice(start, end);
}

describe('ad email review token order', () => {
  it('consumes approval tokens only after approveAd returns success', () => {
    const slice = getFunctionSlice('async function handleAdApprove', "adsRouter.get(\n  '/:id([a-z0-9]{15,50})/approve'");
    expect(slice.indexOf('const result = await approveAd')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result = await approveAd')
    );
  });

  it('consumes rejection tokens only after rejectAd returns success', () => {
    const slice = getFunctionSlice('async function handleAdReject', "adsRouter.get(\n  '/:id([a-z0-9]{15,50})/reject'");
    expect(slice.indexOf('const result = await rejectAd')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result = await rejectAd')
    );
  });

  it('renders explicit already-final ad review pages instead of generic errors', () => {
    expect(src).toContain('function describeAdModerationState(');
    expect(src).toContain("const currentState = describeAdModerationState(summary.status, 'approve');");
    expect(src).toContain("const currentState = describeAdModerationState(summary.status, 'reject');");
    expect(src).toContain('already_final: true,');
  });
});
