import { beforeEach, describe, expect, it } from '@jest/globals';

describe('review token replay protection', () => {
  let signJwt: typeof import('../lib/jwt.js').signJwt;
  let signReviewToken: typeof import('../lib/reviewTokens.js').signReviewToken;
  let verifyReviewToken: typeof import('../lib/reviewTokens.js').verifyReviewToken;
  let consumeReviewToken: typeof import('../lib/reviewTokens.js').consumeReviewToken;
  let resetReviewTokenState: typeof import('../lib/reviewTokens.js').__resetReviewTokenStateForTests;

  beforeEach(async () => {
    ({ signJwt } = await import('../lib/jwt.js'));
    ({
      signReviewToken,
      verifyReviewToken,
      consumeReviewToken,
      __resetReviewTokenStateForTests: resetReviewTokenState,
    } = await import('../lib/reviewTokens.js'));
    resetReviewTokenState();
  });

  it('signs review tokens with a jti and burns them on first use', async () => {
    const token = signReviewToken({ adId: 'ad_123', action: 'approve_ad' }, '1h');
    const payload = verifyReviewToken<{ adId: string; action: string }>(token);

    expect(payload).toMatchObject({ adId: 'ad_123', action: 'approve_ad' });
    expect(payload?.jti).toEqual(expect.any(String));

    expect(await consumeReviewToken(token, payload!)).toBe('consumed');
    expect(await consumeReviewToken(token, payload!)).toBe('already_used');
  });

  it('also blocks replay of legacy review tokens that do not carry a jti', async () => {
    const token = signJwt({ orgId: 'org_123', action: 'approve_league' }, '1h');
    const payload = verifyReviewToken<{ orgId: string; action: string }>(token);

    expect(payload).toMatchObject({ orgId: 'org_123', action: 'approve_league' });
    expect(payload?.jti).toBeUndefined();

    expect(await consumeReviewToken(token, payload!)).toBe('consumed');
    expect(await consumeReviewToken(token, payload!)).toBe('already_used');
  });
});
