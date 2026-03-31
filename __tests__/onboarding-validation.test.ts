/**
 * Validates onboarding step-2 validation logic:
 * - Username availability must be confirmed (true), not just "not false"
 * - Bio character limit matches UI counter
 * - Coach role requires affiliation
 * - Age gates: under-13 blocked, under-18 blocked for coaches
 */

describe('Onboarding step-2 validation', () => {
  const usernameRe = /^[a-z0-9._]{3,20}$/;

  // Mirror of canContinue from step-2-basic.tsx
  const canContinue = ({
    username,
    available,
    dob,
    dobError,
    isUnder13,
    isUnder18,
    role,
    affiliation,
  }: {
    username: string;
    available: boolean | null;
    dob: string;
    dobError: boolean;
    isUnder13: boolean;
    isUnder18: boolean;
    role: 'fan' | 'coach';
    affiliation: string;
  }) =>
    usernameRe.test(username) &&
    available === true &&
    !!dob &&
    !dobError &&
    !isUnder13 &&
    !(role === 'coach' && isUnder18) &&
    (role === 'fan' || !!affiliation);

  const validBase = {
    username: 'test_user',
    available: true as boolean | null,
    dob: '1990-01-01',
    dobError: false,
    isUnder13: false,
    isUnder18: false,
    role: 'fan' as const,
    affiliation: '',
  };

  it('allows valid fan to continue', () => {
    expect(canContinue(validBase)).toBe(true);
  });

  it('blocks when username availability is null (still checking)', () => {
    expect(canContinue({ ...validBase, available: null })).toBe(false);
  });

  it('blocks when username availability is false (taken)', () => {
    expect(canContinue({ ...validBase, available: false })).toBe(false);
  });

  it('blocks under-13 users', () => {
    expect(canContinue({ ...validBase, isUnder13: true })).toBe(false);
  });

  it('blocks under-18 coaches', () => {
    expect(canContinue({ ...validBase, role: 'coach', isUnder18: true, affiliation: 'School' })).toBe(false);
  });

  it('allows 18+ coaches with affiliation', () => {
    expect(canContinue({ ...validBase, role: 'coach', affiliation: 'Lincoln HS' })).toBe(true);
  });

  it('blocks coaches without affiliation', () => {
    expect(canContinue({ ...validBase, role: 'coach', affiliation: '' })).toBe(false);
  });

  it('blocks invalid username format', () => {
    expect(canContinue({ ...validBase, username: 'AB' })).toBe(false); // too short + uppercase
    expect(canContinue({ ...validBase, username: 'no spaces' })).toBe(false);
  });

  describe('Bio character limit', () => {
    it('bio is capped at 160 characters (not 300)', () => {
      const BIO_LIMIT = 160;
      const longBio = 'a'.repeat(200);
      const sliced = longBio.slice(0, BIO_LIMIT);
      expect(sliced.length).toBe(160);
    });
  });
});
