/**
 * useSubscription - Start subscription checkout
 * Encapsulates API calls for subscription-paywall.tsx
 */

import { httpPost } from '@/api/http';
import { useCallback } from 'react';

export interface UseSubscriptionResult {
  subscribe: (plan: string, promoCode?: string) => Promise<{ url?: string }>;
}

export function useSubscription(): UseSubscriptionResult {
  const subscribe = useCallback(async (plan: string, promoCode?: string) => {
    const data: any = await httpPost('/payments/subscribe', {
      plan,
      promo_code: promoCode?.trim() || undefined,
    });
    return data;
  }, []);

  return { subscribe };
}
