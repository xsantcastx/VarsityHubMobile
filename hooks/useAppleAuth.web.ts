/**
 * Web stub for useAppleAuth — Apple Sign-In is iOS-only.
 * Prevents bundling expo-apple-authentication on web.
 */
export function useAppleAuth() {
  return {
    signInWithApple: async () => {
      throw new Error('Apple Sign-In is not available on web');
    },
    loading: false,
    error: null as string | null,
    ready: false,
  };
}
