import { User } from '@/api/entities';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useCallback, useEffect, useState } from 'react';
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
    (async () => {
      try {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (mounted) {
          setAvailable(Boolean(isAvailable));
          console.log('[Apple Auth] Availability check result:', isAvailable);
        }
      } catch (err) {
        console.warn('[Apple Auth] Availability check failed:', err);
        if (mounted) setAvailable(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const signInWithApple = useCallback(async (): Promise<AppleAuthResult> => {
    setError(null);
    setLoading(true);
    try {
      console.log('[Apple Auth] signInWithApple called, available:', available);
      
      // Determine availability: if Apple Sign In isn't available (e.g., Simulator),
      // fall back to a mock credential to allow local dev flows.
      const isSimulator = Platform.OS === 'ios' && !available;
      
      let credential;
      if (isSimulator) {
        console.log('[Apple Auth] Using simulator mock credential');
        // Use a stable user ID for simulator so the same account is reused
        // This prevents creating a new account on every sign-in
        const STABLE_SIMULATOR_USER_ID = 'sim-test-user-stable';
        credential = {
          user: STABLE_SIMULATOR_USER_ID,
          authorizationCode: null,
          identityToken: null,
          email: null,
          fullName: null,
          state: null,
          realUserStatus: 1,
        };
      } else {
        const attemptNativeSignIn = async (scopes: any[]) => {
          console.log('[Apple Auth] Attempting native sign-in with scopes:', scopes);
          return AppleAuthentication.signInAsync({ requestedScopes: scopes });
        };

        try {
          // First attempt with standard scopes
          console.log('[Apple Auth] Starting Apple authentication dialog...');
          credential = await attemptNativeSignIn([
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ]);
          console.log('[Apple Auth] Got credential from native sign-in');
        } catch (appleErr: any) {
          // Log detailed error for diagnostics
          const errCode = String(appleErr?.code || '').toLowerCase();
          const errMsg = String(appleErr?.message || '').toLowerCase();
          
          console.error('[Apple Auth] signInAsync error (scoped):', {
            code: appleErr?.code,
            domain: appleErr?.domain,
            message: appleErr?.message,
          });

          // Check if user actually canceled
          const isCanceled = 
            errCode.includes('canceled') || 
            errCode.includes('cancelled') ||
            errCode === 'err_request_canceled' ||
            errMsg.includes('canceled') || 
            errMsg.includes('cancelled') ||
            errMsg.includes('user canceled');

          if (isCanceled) {
            console.log('[Apple Auth] User canceled sign-in (not an error)');
            throw new Error('User canceled Apple sign-in');
          }

          // Second attempt: retry with no scopes (sometimes fixes unknown auth errors)
          try {
            console.log('[Apple Auth] Retrying with no scopes...');
            credential = await attemptNativeSignIn([]);
            console.log('[Apple Auth] Got credential from retry');
          } catch (retryErr: any) {
            const retryCode = String(retryErr?.code || '').toLowerCase();
            const retryMsg = String(retryErr?.message || '').toLowerCase();
            
            console.error('[Apple Auth] signInAsync retry error (no scopes):', {
              code: retryErr?.code,
              domain: retryErr?.domain,
              message: retryErr?.message,
            });

            // Check if this is also a cancellation
            const isRetryCanceled = 
              retryCode.includes('canceled') || 
              retryCode.includes('cancelled') ||
              retryCode === 'err_request_canceled' ||
              retryMsg.includes('canceled') || 
              retryMsg.includes('cancelled');
            
            if (isRetryCanceled) {
              console.log('[Apple Auth] User canceled on retry (not an error)');
              throw new Error('User canceled Apple sign-in');
            }

            throw retryErr; // bubble up for general handler
          }
        }
      }

      // Prefer identityToken. In Simulator this can be null; fall back to authorizationCode
      // or a stable dev-only token derived from credential.user so local auth works.
      const fallbackToken = credential.authorizationCode || (credential.user ? `sim-${credential.user}` : null);
      const identityToken = credential.identityToken || fallbackToken;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppleAuth.ts:133',message:'Credential obtained, token extracted',data:{hasIdentityToken:!!credential.identityToken,hasAuthorizationCode:!!credential.authorizationCode,hasUser:!!credential.user,hasEmail:!!credential.email,hasIdentityTokenFinal:!!identityToken},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (!identityToken) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppleAuth.ts:135',message:'No token from Apple',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        throw new Error('Apple sign-in did not provide a token');
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppleAuth.ts:139',message:'Starting API call to loginViaApple',data:{hasIdentityToken:!!identityToken},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Send token to your backend (mock accepts any non-empty string in dev)
      // Retry logic for network issues and timeouts
      let res: any = null;
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;
      
      while (attempts < maxAttempts) {
        try {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppleAuth.ts:147',message:'Calling User.loginViaApple',data:{attempt:attempts+1},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          res = await User.loginViaApple(identityToken);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppleAuth.ts:149',message:'loginViaApple response received',data:{hasAccessToken:!!res?.access_token,responseKeys:Object.keys(res||{})},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          if (res?.access_token) {
            return res;
          }
          // If no access token in response, treat as server error and retry
          lastError = new Error('No access token in response');
          attempts++;
        } catch (networkErr: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAppleAuth.ts:156',message:'loginViaApple error',data:{message:networkErr?.message,status:networkErr?.status,attempt:attempts+1},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
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
            console.log(`[Apple Auth] Retry attempt ${attempts}/${maxAttempts} after ${delayMs}ms`);
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
        console.log('[Apple Auth] User canceled sign-in (not showing error)');
        // Don't set error or log exception - user initiated cancellation
        throw err;
      }
      
      // Suppress error logging for expected simulator failures
      if (!(__DEV__ && Platform.OS === 'ios')) {
        console.error('[Apple Auth] Error:', err);
      } else {
        console.log('[Apple Auth] Native Apple auth unavailable (expected in simulator)');
      }
      
      // Dev-only fallback: if native Apple auth fails, use a dev token
      // This is CRITICAL for simulator testing where Apple auth isn't available
      if (__DEV__ && Platform.OS === 'ios') {
        try {
          console.log('[Apple Auth] Attempting dev fallback auth...');
          // Use the owner's email so the dev account is recognized as admin
          // Use a stable token so the same account is reused
          const devEmail = 'emancero@varsityhub.app';
          const devToken = `sim-dev-${devEmail}-stable`;
          const res = await User.loginViaApple(devToken);
          if (res?.access_token) {
            console.log('[Apple Auth] Dev fallback succeeded');
            return res as any;
          }
        } catch (fallbackErr) {
          console.log('[Apple Auth] Dev fallback auth not available (expected), continuing to error handling');
          // continue to normal error mapping below
        }
      }
      
      // In dev/simulator mode, suppress user-facing errors for expected auth failures
      if (__DEV__ && Platform.OS === 'ios') {
        console.log('[Apple Auth] Native auth not available in simulator - expected behavior');
        // Let the error propagate silently so AuthProvider can handle fallback
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
    }
  }, [available]);

  return {
    signInWithApple,
    loading,
    error,
    ready: available,
  };
}
