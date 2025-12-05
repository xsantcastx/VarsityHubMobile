import { User } from '@/api/entities';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

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
      
      // Determine availability: if Apple Sign In isn't available (e.g., Simulator),
      // fall back to a mock credential to allow local dev flows.
      const isSimulator = Platform.OS === 'ios' && !available;
      
      let credential;
      if (isSimulator) {
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
        const attemptNativeSignIn = async (scopes: any[]) => {
          return AppleAuthentication.signInAsync({ requestedScopes: scopes });
        };

        try {
          // First attempt with standard scopes
          credential = await attemptNativeSignIn([
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ]);
        } catch (appleErr: any) {
          // Log detailed error for diagnostics
          console.error('[Apple Auth] signInAsync error (scoped):', {
            code: appleErr?.code,
            domain: appleErr?.domain,
            message: appleErr?.message,
            nativeStack: appleErr?.nativeStack?
              (Array.isArray(appleErr.nativeStack) ? appleErr.nativeStack.slice(0, 5) : appleErr.nativeStack) : undefined,
          });

          const code = String(appleErr?.code || '').toLowerCase();
          const msg = String(appleErr?.message || '').toLowerCase();
          const isCanceled = code.includes('canceled') || msg.includes('canceled') || msg.includes('cancelled');

          if (isCanceled) throw appleErr; // propagate cancel handling

          // Second attempt: retry with no scopes (sometimes fixes unknown auth errors)
          try {
            credential = await attemptNativeSignIn([]);
          } catch (retryErr: any) {
            console.error('[Apple Auth] signInAsync retry error (no scopes):', {
              code: retryErr?.code,
              domain: retryErr?.domain,
              message: retryErr?.message,
            });
            throw retryErr; // bubble up for general handler
          }
        }
      }

      // Prefer identityToken. In Simulator this can be null; fall back to authorizationCode
      // or a stable dev-only token derived from credential.user so local auth works.
      const fallbackToken = credential.authorizationCode || (credential.user ? `sim-${credential.user}` : null);
      const identityToken = credential.identityToken || fallbackToken;
      if (!identityToken) {
        throw new Error('Apple sign-in did not provide a token');
      }

      // Send token to your backend (mock accepts any non-empty string in dev)
      // Retry logic for network issues and timeouts
      let res: any = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          res = await User.loginViaApple(identityToken);
          break;
        } catch (networkErr: any) {
          attempts++;
          const isRetryable = 
            networkErr?.message?.includes('Network request failed') ||
            networkErr?.message?.includes('timeout') ||
            networkErr?.message?.includes('server did not respond') ||
            networkErr?.status === 408 ||
            networkErr?.status === 0;
          
          if (isRetryable && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
          } else {
            console.error('[Apple Auth] Non-retryable error or max attempts reached');
            throw networkErr;
          }
        }
      }

      if (res?.access_token) {
        return res;
      } else {
        throw new Error('Invalid login response from server');
      }
    } catch (err: any) {
      console.error('[Apple Auth] Error:', err);
      const message = err?.message || 'Apple sign-in failed';
      // Dev-only fallback: if native Apple auth fails on device, use mock token path
      if (__DEV__ && Platform.OS === 'ios') {
        try {
          const devToken = `sim-device-${Date.now()}`;
          const res = await User.loginViaApple(devToken);
          if (res?.access_token) {
            return res as any;
          }
        } catch (fallbackErr) {
          console.error('[Apple Auth] Dev fallback failed:', fallbackErr);
          // continue to normal error mapping below
        }
      }
      
      // Don't show error for user cancellation
      if (message.toLowerCase().includes('cancel')) {
        throw new Error('Apple sign-in cancelled');
      }
      
      // User-friendly timeout message
      if (message.includes('timeout') || message.includes('server did not respond')) {
        const friendlyMessage = 'Unable to connect to server. Please check your internet connection and try again.';
        setError(friendlyMessage);
        throw new Error(friendlyMessage);
      }
      
      // Map common Apple auth errors to clearer guidance
      const friendlyHints =
        '\nTips: Ensure you are signed into iCloud on this device, Two‑Factor Authentication is enabled for your Apple ID (Settings > [your name] > Password & Security), and you have a working network connection.';

      if (message.toLowerCase().includes('authorization') || message.toLowerCase().includes('unknown')) {
        const friendly = 'Apple authorization failed.' + friendlyHints;
        setError(friendly);
        throw new Error(friendly);
      }

      setError(message + (Platform.OS === 'ios' ? friendlyHints : ''));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [available]);

  return {
    signInWithApple,
    loading,
    error,
    ready: available,
  };
}
