import * as Application from 'expo-application';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from '@/api/entities';

WebBrowser.maybeCompleteAuthSession();
const { makeRedirectUri } = AuthSession;

let sessionUrlProvider: {
  getRedirectUrl: (options?: Record<string, any>) => string;
  getStartUrl?: (authUrl: string, returnUrl: string, projectNameForProxy?: string) => string;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sessionUrlProvider = require('expo-auth-session/build/SessionUrlProvider').default;
} catch {
  sessionUrlProvider = null;
}

type GoogleAuthResult = Awaited<ReturnType<typeof User.loginViaGoogle>>;

const googleClientConfig = () => {
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const expoClientId = process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  return {
    androidClientId: androidClientId || undefined,
    iosClientId: iosClientId || undefined,
    webClientId: webClientId || undefined,
    expoClientId: expoClientId || undefined,
  };
};

const FORCE_PROXY_FLAG = process.env.EXPO_PUBLIC_GOOGLE_FORCE_PROXY === '1';
const FALLBACK_PROJECT_FULL_NAME = '@xsantcastx/VarsityHubMobile';
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
const PROJECT_FULL_NAME =
  process.env.EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME || derivedProjectFullName || FALLBACK_PROJECT_FULL_NAME;

if (PROJECT_FULL_NAME && sessionUrlProvider?.getRedirectUrl) {
  const originalGetRedirectUrl = sessionUrlProvider.getRedirectUrl.bind(sessionUrlProvider);
  sessionUrlProvider.getRedirectUrl = (options?: Record<string, any>) =>
    originalGetRedirectUrl({ projectNameForProxy: PROJECT_FULL_NAME, ...(options || {}) });
  if (sessionUrlProvider.getStartUrl) {
    const originalGetStartUrl = sessionUrlProvider.getStartUrl.bind(sessionUrlProvider);
    sessionUrlProvider.getStartUrl = (authUrl: string, returnUrl: string, projectNameForProxy?: string) =>
      originalGetStartUrl(authUrl, returnUrl, projectNameForProxy ?? PROJECT_FULL_NAME);
  }
}

export function useGoogleAuth() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const proxyRequested = FORCE_PROXY_FLAG || Constants.appOwnership !== 'standalone';
  const shouldUseProxy = proxyRequested && !!PROJECT_FULL_NAME;

  const clients = useMemo(() => googleClientConfig(), []);
  const isConfigured = useMemo(
    () => Boolean(clients.androidClientId || clients.iosClientId || clients.webClientId || clients.expoClientId),
    [clients],
  );

  const redirectUri = useMemo(() => {
    if (shouldUseProxy && PROJECT_FULL_NAME) {
      try {
        return AuthSession.getRedirectUrl({ projectNameForProxy: PROJECT_FULL_NAME });
      } catch (err) {
        console.warn('[google-auth] Failed to derive proxy redirect URI', err);
      }
    }
    return makeRedirectUri({
      native: `${Application.applicationId}:/oauthredirect`,
      scheme: process.env.EXPO_PUBLIC_APP_SCHEME || 'varsityhubmobile',
      useProxy: false,
    });
  }, [shouldUseProxy]);

  const redirectOptions = useMemo(() => {
    if (shouldUseProxy && PROJECT_FULL_NAME) {
      return { useProxy: true, projectNameForProxy: PROJECT_FULL_NAME };
    }
    return { useProxy: false };
  }, [shouldUseProxy]);

  useEffect(() => {
    console.log('[google-auth]', {
      redirectUri,
      shouldUseProxy,
      projectNameForProxy: shouldUseProxy ? PROJECT_FULL_NAME : null,
      appOwnership: Constants.appOwnership,
      executionEnvironment: Constants.executionEnvironment,
    });
    if (proxyRequested && !PROJECT_FULL_NAME) {
      console.warn(
        '[google-auth] Proxy requested but project full name could not be resolved. Falling back to custom scheme.',
      );
    }
  }, [redirectUri, shouldUseProxy, proxyRequested]);

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
  const [request, , promptAsync] = Google.useAuthRequest(requestConfig, redirectOptions);

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
      const response = await promptAsync(
        shouldUseProxy && PROJECT_FULL_NAME ? { useProxy: true, projectNameForProxy: PROJECT_FULL_NAME } : undefined,
      );
      if (response.type !== 'success' || !response.authentication?.idToken) {
        throw new Error(response.type === 'dismiss' ? 'Google sign-in cancelled' : 'Google sign-in failed');
      }
      const serverResponse = await User.loginViaGoogle(response.authentication.idToken);
      return serverResponse as GoogleAuthResult;
    } catch (err: any) {
      const message = err?.message || 'Unable to sign in with Google';
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, promptAsync, request]);

  return {
    ready: isConfigured && !!request,
    loading,
    error,
    signInWithGoogle,
  };
}
