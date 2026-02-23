/**
 * usePaymentFinalize - Finalize Stripe checkout session (ad payments)
 * Encapsulates API calls for payment-success.tsx
 */

import { Subscriptions } from '@/api/entities';
import { useCallback } from 'react';

export interface UsePaymentFinalizeResult {
  finalizeSession: (sessionId: string) => Promise<void>;
}

export function usePaymentFinalize(): UsePaymentFinalizeResult {
  const finalizeSession = useCallback(async (sessionId: string) => {
    await Subscriptions.finalizeSession(sessionId);
  }, []);

  return { finalizeSession };
}
