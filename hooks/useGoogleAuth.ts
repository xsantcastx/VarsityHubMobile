import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { User } from '@/api/entities';

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthResult = Awaited<ReturnType<typeof User.loginViaGoogle>>;

const selectAppScheme = () => {
  const scheme = process.env.EXPO_PUBLIC_APP_SCHEME;
  return typeof scheme === 'string' && scheme.length > 0 ? scheme : 'varsityhubmobile';
};

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

export function useGoogleAuth() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clients = useMemo(() => googleClientConfig(), []);
  const isConfigured = useMemo(
    () => Boolean(clients.androidClientId || clients.iosClientId || clients.webClientId || clients.expoClientId),
    [clients],
  );

  const redirectUri = useMemo(() => {
    if (Platform.OS === 'web') {
      return makeRedirectUri({
        scheme: selectAppScheme(),
        preferLocalhost: true,
      });
    }
    return undefined;
  }, []);

  // Create request config - use placeholder values if not configured
  // The hook must be called unconditionally (React rules of hooks)
  const requestConfig: Google.GoogleAuthRequestConfig = useMemo(() => {
    // If configured, use real values
    if (isConfigured) {
      const config: Google.GoogleAuthRequestConfig = {
        scopes: ['profile', 'email'],
        androidClientId: clients.androidClientId || undefined,
        iosClientId: clients.iosClientId || undefined,
        webClientId: clients.webClientId || undefined,
        clientId: clients.expoClientId || undefined,
      };
      if (redirectUri) {
        config.redirectUri = redirectUri;
      }
      return config;
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
  }, [isConfigured, redirectUri, clients]);

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
      const response = await promptAsync();
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
