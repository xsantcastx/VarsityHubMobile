export function useAppleAuth() {
  return {
    signInWithApple: async () => {
      throw new Error('Apple Sign-In is not available on web');
    },
    loading: false,
    error: null,
    ready: false,
  };
}
