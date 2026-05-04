import { goBackToTrackedRoute } from '@/utils/navigation';

describe('goBackToTrackedRoute', () => {
  it('replaces with the tracked previous route when it differs from the current route', () => {
    const router = {
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
      replace: jest.fn(),
    } as any;

    goBackToTrackedRoute(router, '/user-profile?id=user-2', '/post-detail?id=post-1');

    expect(router.replace).toHaveBeenCalledWith('/post-detail?id=post-1');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('falls back to router.back when the tracked route matches the current route', () => {
    const router = {
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
      replace: jest.fn(),
    } as any;

    goBackToTrackedRoute(router, '/user-profile?id=user-2', '/user-profile?id=user-2');

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('uses the explicit fallback when there is no tracked route and the router cannot go back', () => {
    const router = {
      back: jest.fn(),
      canGoBack: jest.fn(() => false),
      replace: jest.fn(),
    } as any;

    goBackToTrackedRoute(router, '/user-profile?id=user-2', null, '/(tabs)/feed');

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/feed');
    expect(router.back).not.toHaveBeenCalled();
  });
});
