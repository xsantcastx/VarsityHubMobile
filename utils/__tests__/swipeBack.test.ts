import { shouldDismissSwipe } from '@/utils/swipeBack';

const WIDTH = 400; // commit threshold = 40% = 160px

describe('shouldDismissSwipe (commit-vs-return decision)', () => {
  it('does not dismiss with no movement', () => {
    expect(shouldDismissSwipe(0, 0, WIDTH)).toBe(false);
  });

  it('dismisses when dragged past the distance threshold, even at rest', () => {
    expect(shouldDismissSwipe(200, 0, WIDTH)).toBe(true);
  });

  it('does not dismiss a short drag released at rest', () => {
    expect(shouldDismissSwipe(60, 0, WIDTH)).toBe(false);
  });

  it('dismisses a short drag flicked hard right (momentum projects past)', () => {
    // project(500) ≈ 249.5 → 40 + 249.5 = 289.5 > 160
    expect(shouldDismissSwipe(40, 500, WIDTH)).toBe(true);
  });

  it('does not dismiss when the finger is moving back left at release', () => {
    // Past the distance threshold, but velocity says "returning" → projected point is negative.
    expect(shouldDismissSwipe(100, -1000, WIDTH)).toBe(false);
  });

  it('treats exactly the threshold as not-dismissed (strictly greater)', () => {
    expect(shouldDismissSwipe(160, 0, WIDTH)).toBe(false);
    expect(shouldDismissSwipe(161, 0, WIDTH)).toBe(true);
  });
});
