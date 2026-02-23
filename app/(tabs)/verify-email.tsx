import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Redirect to the main verify screen for email verification.
 * Preserves returnTo param so coaches can return to step-4 after verifying.
 */
export default function VerifyEmailRedirect() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  return <Redirect href={returnTo ? { pathname: '/verify', params: { returnTo } } : '/verify'} />;
}
