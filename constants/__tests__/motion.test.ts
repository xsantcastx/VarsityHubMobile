import { project, rubberband } from '@/constants/motion';

describe('project (momentum landing point)', () => {
  it('returns 0 when there is no velocity', () => {
    expect(project(0)).toBe(0);
  });

  it('projects a resting offset from velocity using Apple decay (decel 0.998)', () => {
    // (1000 / 1000) * 0.998 / (1 - 0.998) = 0.998 / 0.002 = 499
    expect(project(1000)).toBeCloseTo(499, 5);
  });

  it('preserves direction: a negative flick projects a negative offset', () => {
    expect(project(-1000)).toBeCloseTo(-499, 5);
  });

  it('honors a snappier deceleration rate', () => {
    // (1000 / 1000) * 0.99 / (1 - 0.99) = 0.99 / 0.01 = 99
    expect(project(1000, 0.99)).toBeCloseTo(99, 5);
  });
});

describe('rubberband (progressive boundary resistance)', () => {
  it('applies no resistance at the boundary', () => {
    expect(rubberband(0, 800)).toBe(0);
  });

  it('resists past the boundary: output is smaller than the raw overshoot', () => {
    // (100 * 800 * 0.55) / (800 + 0.55 * 100) = 44000 / 855 ≈ 51.46
    expect(rubberband(100, 800)).toBeCloseTo(51.4619883, 4);
    expect(rubberband(100, 800)).toBeLessThan(100);
  });

  it('resists symmetrically on the negative side', () => {
    expect(rubberband(-100, 800)).toBeCloseTo(-51.4619883, 4);
  });

  it('resists harder the further past the boundary (sub-linear growth)', () => {
    const near = rubberband(100, 800);
    const far = rubberband(400, 800);
    // Dragging 4x further should NOT move the element 4x further.
    expect(far).toBeLessThan(near * 4);
  });
});
