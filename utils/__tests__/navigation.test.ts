import {
  getNavigationFallback,
  markNextHistoryEntryAsRedirect,
  performTrackedSafeBack,
} from '@/context/NavigationHistoryContext';
import { replaceAsRedirect, safeGoBack } from '@/utils/navigation';

jest.mock('@/context/NavigationHistoryContext', () => ({
  NavigationHistoryContext: require('react').createContext(undefined),
  getNavigationFallback: jest.fn(() => '/(tabs)/feed'),
  performTrackedSafeBack: jest.fn(() => false),
  markNextHistoryEntryAsRedirect: jest.fn(),
}));

const mockedGetNavigationFallback = getNavigationFallback as jest.MockedFunction<
  typeof getNavigationFallback
>;
const mockedPerformTrackedSafeBack = performTrackedSafeBack as jest.MockedFunction<
  typeof performTrackedSafeBack
>;
const mockedMarkRedirect = markNextHistoryEntryAsRedirect as jest.MockedFunction<
  typeof markNextHistoryEntryAsRedirect
>;

describe('navigation helpers', () => {
  beforeEach(() => {
    mockedGetNavigationFallback.mockReturnValue('/(tabs)/feed');
    mockedPerformTrackedSafeBack.mockReturnValue(false);
    jest.clearAllMocks();
  });

  describe('safeGoBack', () => {
    it('uses router.back when the native stack can go back', () => {
      const router = {
        back: jest.fn(),
        canGoBack: jest.fn(() => true),
        replace: jest.fn(),
      } as any;

      safeGoBack(router);

      expect(router.back).toHaveBeenCalledTimes(1);
      expect(mockedPerformTrackedSafeBack).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('uses tracked history when the native stack is empty', () => {
      const router = {
        back: jest.fn(),
        canGoBack: jest.fn(() => false),
        replace: jest.fn(),
      } as any;
      mockedPerformTrackedSafeBack.mockReturnValue(true);

      safeGoBack(router);

      expect(mockedPerformTrackedSafeBack).toHaveBeenCalledWith(undefined);
      expect(router.back).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('passes an explicit fallback through the tracked-history handler', () => {
      const router = {
        back: jest.fn(),
        canGoBack: jest.fn(() => false),
        replace: jest.fn(),
      } as any;
      mockedPerformTrackedSafeBack.mockReturnValue(true);

      safeGoBack(router, '/(tabs)/discover');

      expect(mockedPerformTrackedSafeBack).toHaveBeenCalledWith('/(tabs)/discover');
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('falls back to the global navigation fallback when tracked history cannot handle it', () => {
      const router = {
        back: jest.fn(),
        canGoBack: jest.fn(() => false),
        replace: jest.fn(),
      } as any;
      mockedGetNavigationFallback.mockReturnValue('/(tabs)/discover');

      safeGoBack(router);

      expect(mockedPerformTrackedSafeBack).toHaveBeenCalledWith(undefined);
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/discover');
    });

    it('uses the explicit fallback when neither the native stack nor tracked history can handle back', () => {
      const router = {
        back: jest.fn(),
        canGoBack: jest.fn(() => false),
        replace: jest.fn(),
      } as any;

      safeGoBack(router, '/organization?tab=teams');

      expect(mockedPerformTrackedSafeBack).toHaveBeenCalledWith('/organization?tab=teams');
      expect(router.replace).toHaveBeenCalledWith('/organization?tab=teams');
    });
  });

  describe('safeGoBack history hygiene', () => {
    it('marks the next history entry as a redirect BEFORE popping the native stack', () => {
      // Without this, every native back records the screen being left as a
      // forward navigation — the history top becomes a screen you already
      // left, and the next history-based back sends you FORWARD to it.
      const order: string[] = [];
      const router = {
        back: jest.fn(() => order.push('back')),
        canGoBack: jest.fn(() => true),
        replace: jest.fn(),
      } as any;
      mockedMarkRedirect.mockImplementation(() => order.push('mark'));

      safeGoBack(router);

      expect(order).toEqual(['mark', 'back']);
    });
  });

  describe('replaceAsRedirect', () => {
    it('marks the next history entry as a redirect BEFORE replacing', () => {
      // Auto-redirects (team-page → program-page, approvals auto-forward,
      // coach guard bounces) must not be recorded as visited screens: a
      // recorded redirect becomes a back target that instantly bounces the
      // user forward again — the coach-tools navigation loop.
      const order: string[] = [];
      const router = {
        back: jest.fn(),
        canGoBack: jest.fn(() => true),
        replace: jest.fn(() => order.push('replace')),
      } as any;
      mockedMarkRedirect.mockImplementation(() => order.push('mark'));

      replaceAsRedirect(router, '/program-page?id=prog-1');

      expect(order).toEqual(['mark', 'replace']);
      expect(router.replace).toHaveBeenCalledWith('/program-page?id=prog-1');
      expect(router.back).not.toHaveBeenCalled();
    });
  });
});
