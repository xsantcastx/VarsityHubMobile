import { Redirect } from 'expo-router';

/**
 * Redirect to the main verify screen for email verification.
 * This route exists to satisfy type checking for navigation to /verify-email.
 */
export default function VerifyEmailRedirect() {
  return <Redirect href="/verify" />;
}
