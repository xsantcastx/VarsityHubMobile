import { useCallback } from 'react';

export type AnalyticsEventPayload = Record<string, any>;

export const useAnalytics = () => {
  const trackTap = useCallback((eventName: string, payload: AnalyticsEventPayload = {}) => {
    try {
      // Reserved for real analytics sink
    } catch {
      // Swallow logging errors – analytics should never break the UX.
    }
  }, []);

  return { trackTap };
};

export default useAnalytics;
