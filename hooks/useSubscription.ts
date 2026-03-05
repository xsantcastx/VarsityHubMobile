import { useAuth } from '@/context/AuthProvider';

export function useSubscription() {
  const { subscriptionTier, hasActiveSubscription } = useAuth();
  return { subscriptionTier, hasActiveSubscription };
}
