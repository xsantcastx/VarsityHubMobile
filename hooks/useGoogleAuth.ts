// ⚠️ WORKING - DO NOT MODIFY WITHOUT EXPLICIT PERMISSION
// Google OAuth fixed 2026-02-24; proxy detection fixed 2026-02-24
// iOS native: uses iOS client ID with native redirect scheme
// Expo Go proxy: uses Web client ID with auth.expo.io redirect
// Changing this will break Google Sign In

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

  // When using proxy (HTTPS redirect via auth.expo.io), we MUST use Web client only.
  // Passing Android/iOS client IDs causes "Custom URI scheme is not enabled for your Android client"
  // because Google rejects native client IDs with HTTPS redirects.
  if (opts.shouldUseProxy && (webClientId || expoClientId)) {
    const webId = webClientId || expoClientId!;
    return {
      androidClientId: webId,
      iosClientId: webId,
      webClientId: webId,
      expoClientId: webId,
      forceWebClient: false,
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
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  const proxyRequested = FORCE_PROXY_FLAG || isExpoGo;
  const shouldUseProxy = proxyRequested && !!PROJECT_FULL_NAME;

  const clients = useMemo(() => googleClientConfig({ shouldUseProxy }), [shouldUseProxy]);

  // Check if Google auth is configured for the CURRENT platform
  const isConfigured = useMemo(() => {
    if (Platform.OS === 'android') {
      return Boolean(clients.androidClientId);
    }
    if (Platform.OS === 'ios') {
      // For iOS, we need either the iOS client ID or Expo client ID (for Expo Go)
      return Boolean(clients.iosClientId || clients.expoClientId);
    }
    if (Platform.OS === 'web') {
      return Boolean(clients.webClientId);
    }
    // Fallback: any client ID configured
    return Boolean(clients.androidClientId || clients.iosClientId || clients.webClientId || clients.expoClientId);
  }, [clients]);

  const redirectUri = useMemo(() => {
    let uri = '';

    // For web platform, use current origin
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.location?.origin) {
        uri = window.location.origin;
      } else {
        // Fallback to production URL for SSR or missing window
        uri = appConfig.webBaseUrl || 'https://varsityhub.app';
      }
      console.log('[google-auth] Using web redirect:', uri);
      return uri;
    }

    // Proxy: use https://auth.expo.io/@owner/slug (getRedirectUrl throws without projectNameForProxy)
    if (shouldUseProxy && PROJECT_FULL_NAME) {
      try {
        uri = AuthSession.getRedirectUrl();
      } catch {
        uri = `https://auth.expo.io/${PROJECT_FULL_NAME}`;
      }
      console.log('[google-auth] Using Expo proxy redirect:', uri);
      return uri;
    }

    // For standalone iOS, use native redirect with reversed iOS client ID scheme
    // CRITICAL: Use real iOS client from config, NOT clients (which may be web when proxy was requested)
    const isStandaloneIOS = Platform.OS === 'ios' && Constants.appOwnership !== 'expo';
    const realIosClientId = appConfig.google.iosClientId;
    if (isStandaloneIOS && realIosClientId) {
      // Convert xxx-yyy.apps.googleusercontent.com → com.googleusercontent.apps.xxx-yyy
      const prefix = realIosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
      const scheme = `com.googleusercontent.apps.${prefix}`;
      uri = makeRedirectUri({
        native: `${scheme}:/oauthredirect`,
      });
      console.log('[google-auth] Using iOS native redirect:', uri);
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
  const requestConfig = useMemo((): Google.GoogleAuthRequestConfig => {
    // If configured, use real values
    if (isConfigured) {
      return {
        scopes: ['profile', 'email'],
        redirectUri,
        androidClientId: clients.androidClientId,
        iosClientId: clients.iosClientId,
        webClientId: clients.webClientId,
        clientId: clients.expoClientId || '',
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
      // DEBUG: (1) full Google auth response
      console.log('[google-auth] DEBUG full response:', JSON.stringify(response, null, 2));

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
      if (response.type !== 'success') {
        const errorMsg = `Google sign-in failed: ${response.type}`;
        console.error('[google-auth]', errorMsg, response);
        throw new Error(errorMsg);
      }

      let idToken: string | null = response.authentication?.idToken ?? null;

      // Auth code flow: exchange the code for tokens when no idToken is directly available
      if (!idToken && response.params?.code) {
        console.log('[google-auth] Got auth code, exchanging for tokens...');

        const clientId =
          Platform.OS === 'ios'
            ? (clients.iosClientId || clients.webClientId || '')
            : Platform.OS === 'android'
              ? (clients.androidClientId || clients.webClientId || '')
              : (clients.webClientId || '');

        const body: Record<string, string> = {
          code: response.params.code,
          client_id: clientId,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        };

        // Include PKCE code verifier if present (expo-auth-session uses PKCE by default)
        if (request?.codeVerifier) {
          body.code_verifier = request.codeVerifier;
        }

        // DEBUG: compare redirect_uri and client_id between auth request and token exchange
        console.log('[google-auth] DEBUG auth request redirectUri:', requestConfig.redirectUri);
        console.log('[google-auth] DEBUG token exchange redirect_uri:', body.redirect_uri);
        console.log('[google-auth] DEBUG redirect_uri match:', requestConfig.redirectUri === body.redirect_uri);
        console.log('[google-auth] DEBUG token exchange client_id:', body.client_id);
        console.log('[google-auth] DEBUG request.url (actual auth URL):', request?.url);
        console.log('[google-auth] DEBUG has code_verifier:', !!body.code_verifier);

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: Object.entries(body)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&'),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.id_token) {
          idToken = tokenData.id_token;
          console.log('[google-auth] Got idToken from code exchange');
        } else if (tokenData.access_token) {
          idToken = tokenData.access_token;
          console.log('[google-auth] Using access_token as fallback from code exchange');
        } else {
          console.error('[google-auth] Token exchange failed:', tokenData);
          throw new Error(tokenData.error_description || 'Failed to exchange auth code for tokens');
        }
      }

      if (!idToken) {
        throw new Error('Google sign-in completed but no token was received');
      }

      // DEBUG: (2) token preview
      console.log('[google-auth] DEBUG idToken preview:', idToken.substring(0, 50) + '...' + idToken.substring(idToken.length - 20));
      // DEBUG: (3) decode JWT payload to see aud/iss
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          console.log('[google-auth] DEBUG JWT aud:', payload.aud);
          console.log('[google-auth] DEBUG JWT iss:', payload.iss);
          console.log('[google-auth] DEBUG JWT email:', payload.email);
          console.log('[google-auth] DEBUG JWT azp:', payload.azp);
        } else {
          console.log('[google-auth] DEBUG token is NOT a JWT (parts:', parts.length, ')');
        }
      } catch (decodeErr) {
        console.log('[google-auth] DEBUG JWT decode failed:', decodeErr);
      }
      // DEBUG: (4) exact request to backend
      const apiBase = require('@/api/http').getApiBaseUrl();
      console.log('[google-auth] DEBUG sending to:', apiBase + '/auth/google', JSON.stringify({ id_token: idToken.substring(0, 30) + '...' }));

      console.log('[google-auth] Got idToken, sending to server...');
      const serverResponse = await User.loginViaGoogle(idToken);
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
