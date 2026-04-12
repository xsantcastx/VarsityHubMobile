import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  clearAuthToken,
  getAuthToken,
  httpGet,
  httpPost,
  httpPostLongTimeout,
  setAuthToken,
} from './http';

// Storage keys for authentication tokens (not secrets, just key names)
const TOKEN_KEY = 'auth_token_key';
const REFRESH_TOKEN_KEY = 'auth_refresh_token_key';

// Track if we're currently refreshing to prevent multiple concurrent refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

async function saveToken(token: string | null) {
  setAuthToken(token);
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(TOKEN_KEY, token || '');
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token || '');
    }
  } catch (error) {
    console.error('[auth] Failed to save token to secure storage:', error);
  }
}

async function saveRefreshToken(token: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (token) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } else {
      if (token) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      } else {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    }
  } catch (error) {
    console.error('[auth] Failed to save refresh token:', error);
  }
}

async function loadRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(REFRESH_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    console.error('[auth] Failed to load refresh token:', error);
    return null;
  }
}

async function clearRefreshToken() {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    console.warn('[auth] Failed to clear refresh token:', error);
  }
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token on success, null on failure.
 */
async function refreshAccessToken(): Promise<string | null> {
  // Prevent concurrent refresh attempts
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = await loadRefreshToken();
  if (!refreshToken) {
    if (__DEV__) console.log('[auth] No refresh token available');
    return null;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      if (__DEV__) console.log('[auth] Attempting to refresh access token...');

      // Call refresh endpoint without auth header (uses refresh token in body)
      const res = await httpPost('/auth/refresh', { refresh_token: refreshToken });

      if (res?.access_token) {
        await saveToken(res.access_token);
        if (res.refresh_token) {
          await saveRefreshToken(res.refresh_token);
        }
        if (__DEV__) console.log('[auth] Token refreshed successfully');
        return res.access_token;
      }

      // If no access token returned, refresh failed
      if (__DEV__) console.warn('[auth] Refresh response missing access_token');
      return null;
    } catch (error: any) {
      // If refresh fails (e.g., expired refresh token), clear all tokens
      console.error('[auth] Token refresh failed:', error?.message || error);
      await saveToken(null);
      await clearRefreshToken();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function loadToken(): Promise<string | null> {
  const cached = getAuthToken();
  if (cached) return cached;
  let t: string | null = null;
  try {
    if (Platform.OS === 'web') t = window.localStorage.getItem(TOKEN_KEY);
    else t = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('[auth] Failed to load token from secure storage:', error);
  }
  if (t) setAuthToken(t);
  return t;
}

export const auth = {
  async register(email: string, password: string, display_name?: string) {
    const res = await httpPostLongTimeout('/auth/register', { email, password, display_name });
    if ((res as any)?.access_token) await saveToken((res as any).access_token);
    if ((res as any)?.refresh_token) await saveRefreshToken((res as any).refresh_token);
    return res;
  },
  async login(email: string, password: string) {
    const res = await httpPost('/auth/login', { email, password });
    if (res?.access_token) await saveToken(res.access_token);
    if (res?.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async loginWithGoogle(idToken: string) {
    const res = await httpPost('/auth/google', { id_token: idToken });
    if (res?.access_token) await saveToken(res.access_token);
    if (res?.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async loginWithApple(identityToken: string) {
    // Apple auth can be slow on real devices; allow longer timeout
    const res = await httpPostLongTimeout('/auth/apple', { identity_token: identityToken });
    if (res?.access_token) await saveToken(res.access_token);
    if (res?.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async me() {
    // Short-circuit when the client has no credentials at all. Previously
    // a fresh/logged-out app shell (ThemeProvider's useCustomColorScheme
    // loads the theme on mount and calls User.me()) would fire an
    // unauthenticated `GET /me` and take a visible 401 in the browser
    // network panel. No token + no refresh token means we know the answer.
    const token = await loadToken();
    if (!token) {
      const refreshable = await loadRefreshToken();
      if (!refreshable) {
        const err: any = new Error('Not authenticated');
        err.status = 401;
        err.code = 'NO_CREDENTIALS';
        throw err;
      }
    }
    const options = {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'If-None-Match': '',
      },
    };
    try {
      return await httpGet('/me', options);
    } catch (e: any) {
      // On 401, try to refresh the token before giving up
      if (e && e.status === 401) {
        if (__DEV__) console.log('[auth] Got 401 on /me, attempting token refresh...');

        const newToken = await refreshAccessToken();
        if (newToken) {
          // Token refreshed successfully, retry the request
          try {
            return await httpGet('/me', options);
          } catch (retryError: any) {
            // If retry fails too, log out
            if (__DEV__)
              console.warn('[auth] /me retry after refresh failed:', retryError?.message);
            try {
              await auth.logout();
            } catch (logoutError) {
              console.warn('[auth] Cleanup logout failed:', logoutError);
            }
            throw retryError;
          }
        } else {
          // Refresh failed, clear session
          try {
            await auth.logout();
          } catch (logoutError) {
            console.warn('[auth] Cleanup logout failed:', logoutError);
          }
        }
      }
      throw e;
    }
  },
  async logout() {
    clearAuthToken();
    try {
      if (Platform.OS === 'web') window.localStorage.removeItem(TOKEN_KEY);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.warn('[auth] Failed to clear token from secure storage:', error);
    }
    // Also clear refresh token
    await clearRefreshToken();
  },
  async requestEmailVerification() {
    await loadToken();
    return httpPost('/auth/verify/request', {});
  },
  async verifyEmail(code: string) {
    await loadToken();
    return httpPost('/auth/verify/confirm', { code });
  },
  async requestPasswordReset(email: string) {
    return httpPost('/auth/password/forgot', { email });
  },
  async resetPassword(email: string, code: string, password: string) {
    return httpPost('/auth/password/reset', { email, code, password });
  },
  async changePassword(currentPassword: string, newPassword: string) {
    await loadToken();
    return httpPost('/auth/password/change', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
  getToken: loadToken,
  refreshToken: refreshAccessToken,
  hasRefreshToken: async () => !!(await loadRefreshToken()),
};

export default auth;
