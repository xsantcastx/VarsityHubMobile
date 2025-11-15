import { User } from '@/api/entities';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

type AppleAuthResult = Awaited<ReturnType<typeof User.loginViaApple>>;

export function useAppleAuth() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then(v => { if (mounted) setAvailable(Boolean(v)); })
      .catch(() => { if (mounted) setAvailable(false); });
    return () => { mounted = false; };
  }, []);

  const signInWithApple = useCallback(async (): Promise<AppleAuthResult> => {
    setError(null);
    setLoading(true);
    try {
      console.log('[Apple Auth] Starting Apple sign in...');
      console.log('[Apple Auth] Calling AppleAuthentication.signInAsync...');
      
      // For iOS Simulator testing: Apple Sign In requires a real device
      // Use a mock credential for simulator
      const isSimulator = __DEV__ && Platform.OS === 'ios';
      
      let credential;
      if (isSimulator) {
        console.log('[Apple Auth] SIMULATOR MODE - using mock credential');
        // Create a mock credential for testing
        credential = {
          user: 'sim-test-user-' + Date.now(),
          authorizationCode: null,
          identityToken: null,
          email: null,
          fullName: null,
          state: null,
          realUserStatus: 1,
        };
      } else {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        }).catch((appleErr: any) => {
          console.error('[Apple Auth] signInAsync threw error:', appleErr);
          console.error('[Apple Auth] Error type:', appleErr?.code, appleErr?.message);
          throw appleErr;
        });
      }
      console.log('[Apple Auth] Got credential:', { user: credential.user, hasToken: !!credential.identityToken });

      // Prefer identityToken. In Simulator this can be null; fall back to authorizationCode
      // or a stable dev-only token derived from credential.user so local auth works.
      const fallbackToken = credential.authorizationCode || (credential.user ? `sim-${credential.user}` : null);
      const identityToken = credential.identityToken || fallbackToken;
      if (!identityToken) {
        throw new Error('Apple sign-in did not provide a token');
      }

      console.log('[Apple Auth] Sending token to backend...');
      // Send token to your backend (mock accepts any non-empty string in dev)
      const res: any = await User.loginViaApple(identityToken);
      console.log('[Apple Auth] Backend response:', { hasToken: !!res?.access_token, needsOnboarding: res?.needs_onboarding });

      if (res?.access_token) {
        return res;
      } else {
        throw new Error('Invalid login response from server');
      }
    } catch (err: any) {
      console.error('[Apple Auth] Error:', err);
      const message = err?.message || 'Apple sign-in failed';
      if (message.toLowerCase().includes('cancel')) {
        throw new Error('Apple sign-in cancelled');
      }
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    signInWithApple,
    loading,
    error,
    ready: available,
  };
}
