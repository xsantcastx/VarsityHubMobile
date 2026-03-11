import { User } from '@/api/entities';
import { getApiBaseUrl } from '@/api/http';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type AppleAuthResult = Awaited<ReturnType<typeof User.loginViaApple>>;

export function useAppleAuth() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean>(false);

  // Check Apple Auth availability once on mount
  // IMPORTANT: Just checking availability should NOT trigger the auth dialog
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (mounted) {
          setAvailable(Boolean(isAvailable));
          // eslint-disable-next-line no-console
          if (__DEV__) console.log('[Apple Auth] Availability check result:', isAvailable);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        if (__DEV__) console.warn('[Apple Auth] Availability check failed:', err);
        if (mounted) setAvailable(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const signInInProgressRef = useRef(false);

  const signInWithApple = useCallback(async (): Promise<AppleAuthResult> => {
    if (signInInProgressRef.current) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log('[Apple Auth] Sign-in already in progress, skipping duplicate call');
      throw new Error('User canceled Apple sign-in');
    }
    signInInProgressRef.current = true;
    setError(null);
    setLoading(true);
    try {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log('[Apple Auth] signInWithApple called, available:', available);
      
      // Determine availability: if Apple Sign In isn't available (e.g., Simulator),
      // fall back to a mock credential to allow local dev flows.
      const isSimulator = Platform.OS === 'ios' && !available;

      // Don't send mock tokens to production — they'll be rejected.
      // Mock tokens only work against a local dev server.
      if (isSimulator) {
        const apiBase = getApiBaseUrl();
        const isProduction = !apiBase.includes('localhost') && !apiBase.includes('127.0.0.1');
        if (isProduction) {
          throw new Error('Apple Sign-In is not available in the simulator. Please test on a real device or use email/password.');
        }
      }

      let credential;
      if (isSimulator) {
        // eslint-disable-next-line no-console
        if (__DEV__) console.log('[Apple Auth] Using simulator mock credential (local dev server)');
        // Create a STABLE mock credential for testing - same ID every time
        // This prevents creating duplicate accounts in simulator
        credential = {
          user: 'sim-dev-apple-user',  // Stable ID - same user every sign-in
          authorizationCode: null,
          identityToken: null,
          email: 'simulator@appleid.local',  // Stable email for account linking
          fullName: null,
          state: null,
          realUserStatus: 1,
        };
      } else {
        const attemptNativeSignIn = async (scopes: any[]) => {
          // eslint-disable-next-line no-console
          if (__DEV__) console.log('[Apple Auth] Attempting native sign-in with scopes:', scopes);
          return AppleAuthentication.signInAsync({ requestedScopes: scopes });
        };

        try {
          // First attempt with standard scopes
          // eslint-disable-next-line no-console
          if (__DEV__) console.log('[Apple Auth] Starting Apple authentication dialog...');
          credential = await attemptNativeSignIn([
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ]);
          // eslint-disable-next-line no-console
          if (__DEV__) console.log('[Apple Auth] Got credential from native sign-in');
        } catch (appleErr: any) {
          const errCode = String(appleErr?.code || '').toLowerCase();
          const errMsg = String(appleErr?.message || '').toLowerCase();

          // Check if user actually canceled
          const isCanceled =
            errCode.includes('canceled') ||
            errCode.includes('cancelled') ||
            errCode === 'err_request_canceled' ||
            errMsg.includes('canceled') ||
            errMsg.includes('cancelled') ||
            errMsg.includes('user canceled');

          if (isCanceled) {
            // eslint-disable-next-line no-console
            if (__DEV__) console.log('[Apple Auth] User canceled sign-in (not an error)');
            throw new Error('User canceled Apple sign-in');
          }

          // ERR_REQUEST_UNKNOWN in simulator = Apple Sign-In doesn't work there
          // Fall back to simulator mock so dev/testing can continue
          const isSimulatorUnknown =
            errCode === 'err_request_unknown' ||
            errMsg.includes('unknown reason');
          if (__DEV__ && Platform.OS === 'ios' && isSimulatorUnknown) {
            // eslint-disable-next-line no-console
            if (__DEV__) console.log('[Apple Auth] Simulator fallback (native auth unavailable)');
            credential = {
              user: 'sim-dev-apple-user',
              authorizationCode: null,
              identityToken: null,
              email: 'simulator@appleid.local',
              fullName: null,
              state: null,
              realUserStatus: 1,
            };
          } else {
            // Retry with no scopes (sometimes fixes unknown auth on real device)
            try {
              credential = await attemptNativeSignIn([]);
            } catch (retryErr: any) {
              const retryCode = String(retryErr?.code || '').toLowerCase();
              const retryMsg = String(retryErr?.message || '').toLowerCase();
              const isRetryCanceled =
                retryCode.includes('canceled') ||
                retryCode.includes('cancelled') ||
                retryCode === 'err_request_canceled' ||
                retryMsg.includes('canceled') ||
                retryMsg.includes('cancelled');
              if (isRetryCanceled) {
                throw new Error('User canceled Apple sign-in');
              }
              throw retryErr;
            }
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
      let lastError: any = null;
      
      while (attempts < maxAttempts) {
        try {
          res = await User.loginViaApple(identityToken);
          if (res?.access_token) {
            return res;
          }
          // If no access token in response, treat as server error and retry
          lastError = new Error('No access token in response');
          attempts++;
        } catch (networkErr: any) {
          lastError = networkErr;
          attempts++;
          const isRetryable = 
            networkErr?.message?.includes('Network request failed') ||
            networkErr?.message?.includes('timeout') ||
            networkErr?.message?.includes('server did not respond') ||
            networkErr?.status === 408 ||
            networkErr?.status === 0 ||
            networkErr?.status === 500 ||
            networkErr?.status === 502 ||
            networkErr?.status === 503;
          
          if (isRetryable && attempts < maxAttempts) {
            const delayMs = 1000 * Math.pow(2, attempts - 1); // exponential backoff: 1s, 2s, 4s
            // eslint-disable-next-line no-console
            if (__DEV__) console.log(`[Apple Auth] Retry attempt ${attempts}/${maxAttempts} after ${delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }

      // All retries exhausted
      if (lastError) {
        throw lastError;
      }
      throw new Error('Invalid login response from server');
    } catch (err: any) {
      const message = err?.message || 'Apple sign-in failed';
      const code = String(err?.code || '').toLowerCase();
      
      // Check if this is a user cancellation (not an error)
      const isCanceled = 
        message.toLowerCase().includes('cancel') ||
        code.includes('canceled') ||
        code.includes('cancelled') ||
        code === 'err_request_canceled';
      
      if (isCanceled) {
        // eslint-disable-next-line no-console
        if (__DEV__) console.log('[Apple Auth] User canceled sign-in (not showing error)');
        // Don't set error or log exception - user initiated cancellation
        throw err;
      }
      
      // Suppress error logging for expected simulator failures
      if (!(__DEV__ && Platform.OS === 'ios')) {
        // eslint-disable-next-line no-console
        if (__DEV__) console.error('[Apple Auth] Error:', err);
      } else {
        // eslint-disable-next-line no-console
        if (__DEV__) console.log('[Apple Auth] Native Apple auth unavailable (expected in simulator)');
      }
      
      // In dev/simulator mode, suppress user-facing errors for expected auth failures
      if (__DEV__ && Platform.OS === 'ios') {
        // eslint-disable-next-line no-console
        if (__DEV__) console.log('[Apple Auth] Native auth not available in simulator - expected behavior');
        throw err;
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
      signInInProgressRef.current = false;
    }
  }, [available]);

  return {
    signInWithApple,
    loading,
    error,
    ready: available,
  };
}
