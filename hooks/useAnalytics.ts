import { useCallback } from 'react';

export type AnalyticsEventPayload = Record<string, any>;

export const useAnalytics = () => {
  const trackTap = useCallback((eventName: string, payload: AnalyticsEventPayload = {}) => {
    try {
      const info = { event: eventName, ...payload };
      // For now, log taps so we can replace with a real analytics sink later.
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[analytics]', info);
      }
    } catch (error) {
      // Swallow logging errors – analytics should never break the UX.
    }
  }, []);

  return { trackTap };
};

export default useAnalytics;
