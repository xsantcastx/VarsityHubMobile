import { User } from '@/api/entities';
import { getConfig } from '@/config/env';
import * as Application from 'expo-application';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();
const { makeRedirectUri } = AuthSession;

type GoogleAuthResult = Awaited<ReturnType<typeof User.loginViaGoogle>>;

const appConfig = getConfig();

const googleClientConfig = (opts: { shouldUseProxy: boolean }) => {
  const { google } = appConfig;
  const androidClientId = google.androidClientId;
  const iosClientId = google.iosClientId;
  const webClientId = google.webClientId;
  const expoClientId = google.expoClientId;

  const isDevSimulator = opts.shouldUseProxy && Constants.appOwnership === 'expo' && Platform.OS === 'ios';
  const isStandaloneIOS = Platform.OS === 'ios' && Constants.appOwnership !== 'expo';

  // For dev simulator, use Expo Client ID (registered with auth.expo.io)
  // For standalone iOS builds, use web client with varsityhub.app domain
  if (isDevSimulator && expoClientId) {
    return {
      androidClientId: expoClientId,
      iosClientId: expoClientId,
      webClientId: expoClientId,
      expoClientId,
      forceWebClient: false,
    } as const;
  }

  if (isStandaloneIOS && webClientId) {
    return {
      androidClientId: webClientId,
      iosClientId: webClientId,
      webClientId,
      expoClientId: webClientId,
    } as const;
  }

  return { androidClientId, iosClientId, webClientId, expoClientId } as const;
};

const FORCE_PROXY_FLAG = appConfig.google.forceProxy;
const FALLBACK_PROJECT_FULL_NAME = '@lime_prod/VarsityHubMobile';
const expoConfig: any = Constants.expoConfig ?? {};
const expoSlug: string | undefined = expoConfig.slug || expoConfig.name;
const expoOwner: string | undefined = expoConfig.owner;
const expoOriginalFullName: string | undefined = (expoConfig as any)?.extra?.expoGo?.projectFullName;
const derivedProjectFullName =
  typeof expoOriginalFullName === 'string'
    ? expoOriginalFullName
    : typeof expoSlug === 'string'
      ? `${expoOwner ? `@${expoOwner}` : '@anonymous'}/${expoSlug}`
      : undefined;
const PROJECT_FULL_NAME = appConfig.expoProjectFullName || derivedProjectFullName || FALLBACK_PROJECT_FULL_NAME;

export function useGoogleAuth() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const proxyRequested = FORCE_PROXY_FLAG || Constants.appOwnership === null;
  const shouldUseProxy = proxyRequested && !!PROJECT_FULL_NAME;

  const clients = useMemo(() => googleClientConfig({ shouldUseProxy }), [shouldUseProxy]);
  const isConfigured = useMemo(
    () => Boolean(clients.androidClientId || clients.iosClientId || clients.webClientId || clients.expoClientId),
    [clients],
  );

  const redirectUri = useMemo(() => {
    let uri = '';

    // For web platform, ALWAYS use localhost (highest priority)
    if (Platform.OS === 'web') {
      // Use window.location.origin if available (works for any port), fallback to 8081
      uri = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:8081';
      console.log('[google-auth] Using web redirect:', uri);
      return uri;
    }

    try {
      if (shouldUseProxy && PROJECT_FULL_NAME) {
        uri = AuthSession.getRedirectUrl();
        console.log('[google-auth] Using Expo proxy redirect:', uri);
        return uri;
      }
    } catch (err) {
      console.warn('[google-auth] failed to build proxy redirect uri', err);
    }

    // For production iOS with web client, use web redirect
    const isStandaloneIOS = Platform.OS === 'ios' && Constants.appOwnership !== 'expo';
    if (isStandaloneIOS) {
      uri = `${appConfig.webBaseUrl}/auth/google/callback`;
      console.log('[google-auth] Using production web redirect (standalone):', uri);
      return uri;
    }

    uri = makeRedirectUri({
      native: `${Application.applicationId}:/oauthredirect`,
      scheme: appConfig.appScheme,
    });
    console.log('[google-auth] Using custom scheme redirect:', uri, '(app scheme:', appConfig.appScheme, ')');
    return uri;
  }, [shouldUseProxy]);

  useEffect(() => {
    if (proxyRequested && !PROJECT_FULL_NAME) {
      console.warn(
        '[google-auth] Proxy requested but project full name could not be resolved. Falling back to custom scheme.',
      );
    }
  }, [proxyRequested]);

  // Create request config - use placeholder values if not configured
  // The hook must be called unconditionally (React rules of hooks)
  const requestConfig: Google.GoogleAuthRequestConfig = useMemo(() => {
    // If configured, use real values
    if (isConfigured) {
      return {
        scopes: ['profile', 'email'],
        redirectUri,
        androidClientId: clients.androidClientId || undefined,
        iosClientId: clients.iosClientId || undefined,
        webClientId: clients.webClientId || undefined,
        clientId: clients.expoClientId || undefined,
      };
    }

    // If not configured, provide placeholder values that satisfy the hook
    // We won't actually use this to sign in (isConfigured check prevents it)
    return {
      scopes: ['profile', 'email'],
      redirectUri,
      // Use fake but valid-looking client IDs for all platforms
      androidClientId: '000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',
      iosClientId: '000000000000-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy.apps.googleusercontent.com',
      webClientId: '000000000000-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz.apps.googleusercontent.com',
      clientId: '000000000000-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww.apps.googleusercontent.com',
    };
  }, [isConfigured, clients, redirectUri]);

  // Always call useAuthRequest (React rules of hooks)
  const [request, , promptAsync] = Google.useAuthRequest(requestConfig);

  const signInWithGoogle = useCallback(async (): Promise<GoogleAuthResult> => {
    if (!isConfigured) {
      throw new Error('Google sign-in is not configured');
    }
    if (!request) {
      throw new Error('Google sign-in is not ready yet');
    }
    setError(null);
    setLoading(true);
    try {
      console.log('[google-auth] Starting Google sign-in...');
      console.log('[google-auth] Using redirect URI:', redirectUri);
      console.log('[google-auth] Request config:', requestConfig);

      const response = await promptAsync();
      console.log('[google-auth] Response from Google:', response);

      // Handle user cancellation gracefully - don't throw
      if (response.type === 'cancel' || response.type === 'dismiss') {
        console.log('[google-auth] User cancelled sign-in');
        setLoading(false);
        // Return a specific error that can be caught and ignored
        const err: any = new Error('GOOGLE_SIGN_IN_CANCELLED');
        err.code = 'CANCELLED';
        throw err;
      }

      // Handle other non-success responses
      if (response.type !== 'success' || !response.authentication?.idToken) {
        const errorMsg = `Google sign-in failed: ${response.type}`;
        console.error('[google-auth]', errorMsg, response);
        throw new Error(errorMsg);
      }

      console.log('[google-auth] Got idToken, sending to server...');
      const serverResponse = await User.loginViaGoogle(response.authentication.idToken);
      console.log('[google-auth] Server accepted token, logged in as:', serverResponse);
      return serverResponse as GoogleAuthResult;
    } catch (err: any) {
      // If user cancelled, re-throw so caller can handle gracefully
      if (err?.code === 'CANCELLED' || err?.message === 'GOOGLE_SIGN_IN_CANCELLED') {
        throw err;
      }

      const message = err?.message || 'Unable to sign in with Google';
      console.error('[google-auth] Error:', message, err);
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, promptAsync, request, redirectUri, requestConfig]);

  return {
    ready: isConfigured && !!request,
    loading,
    error,
    signInWithGoogle,
  };
}
