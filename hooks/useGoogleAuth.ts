import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

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

  const redirectUri = useMemo(
    () =>
      makeRedirectUri({
        scheme: selectAppScheme(),
        preferLocalhost: Platform.OS === 'web',
      }),
    [],
  );

  const requestConfig: Google.GoogleAuthRequestConfig = {
    scopes: ['profile', 'email'],
    redirectUri,
  };
  if (clients.androidClientId) requestConfig.androidClientId = clients.androidClientId;
  if (clients.iosClientId) requestConfig.iosClientId = clients.iosClientId;
  if (clients.webClientId) requestConfig.webClientId = clients.webClientId;
  if (clients.expoClientId) requestConfig.expoClientId = clients.expoClientId;

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
