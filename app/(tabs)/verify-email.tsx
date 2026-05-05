import { Redirect } from 'expo-router';

/**
 * Compatibility alias for older links and stale in-app navigation targets.
 * The canonical email-verification screen is /verify.
 */
export default function VerifyEmailRedirect() {
  return <Redirect href="/verify" />;
}
