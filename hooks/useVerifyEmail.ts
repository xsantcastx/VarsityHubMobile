/**
 * useVerifyEmail - Send verification code for onboarding finish
 * Encapsulates API calls for onboarding/finish.tsx
 */

import { httpPost } from '@/api/http';
import { useCallback } from 'react';

export interface UseVerifyEmailResult {
  sendCode: () => Promise<void>;
}

export function useVerifyEmail(): UseVerifyEmailResult {
  const sendCode = useCallback(async () => {
    await httpPost('/auth/verify/send', {});
  }, []);

  return { sendCode };
}
