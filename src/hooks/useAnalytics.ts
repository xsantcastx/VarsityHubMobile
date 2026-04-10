import { useCallback } from 'react';

export type AnalyticsEventPayload = Record<string, any>;

export const useAnalytics = () => {
  const trackTap = useCallback((eventName: string, payload: AnalyticsEventPayload = {}) => {
    try {
      // Reserved for real analytics sink
      if (__DEV__) console.log('[analytics] trackTap:', eventName, payload);
    } catch (error) {
      // Swallow logging errors – analytics should never break the UX.
      if (__DEV__) console.warn('[analytics] trackTap error:', error);
    }
  }, []);

  return { trackTap };
};

export default useAnalytics;
