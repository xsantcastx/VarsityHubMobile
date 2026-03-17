import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { clearAuthToken, getApiBaseUrl, getAuthToken, httpGet, httpPost, httpPostLongTimeout, setAuthToken } from './http';

// Storage keys for authentication tokens (not secrets, just key names)
const TOKEN_KEY = 'auth_token_key';
const REFRESH_TOKEN_KEY = 'refresh_token_key';

async function saveToken(token: string | null) {
  setAuthToken(token);
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(TOKEN_KEY, token || '');
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token || '');
    }
  } catch (error) {
    if (__DEV__) console.error('[auth] Failed to save token to secure storage:', error);
  }
}

async function saveRefreshToken(token: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (token) window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
      else window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    } else {
      if (token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    if (__DEV__) console.error('[auth] Failed to save refresh token to secure storage:', error);
  }
}

async function loadRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(REFRESH_TOKEN_KEY);
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    if (__DEV__) console.error('[auth] Failed to load refresh token from secure storage:', error);
    return null;
  }
}

export async function loadToken(): Promise<string | null> {
  const cached = getAuthToken();
  if (cached) return cached;
  let t: string | null = null;
  try {
    if (Platform.OS === 'web') t = window.localStorage.getItem(TOKEN_KEY);
    else t = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    if (__DEV__) console.error('[auth] Failed to load token from secure storage:', error);
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
    await loadToken();
    const options = {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'If-None-Match': '',
      },
    };
    try {
      return await httpGet('/me', options);
    } catch (e: any) {
      // On 401, session expired — log out and re-throw
      if (e && e.status === 401) {
        try { await auth.logout(); } catch (logoutError) {
          if (__DEV__) console.warn('[auth] Cleanup logout failed:', logoutError);
        }
      }
      throw e;
    }
  },
  async logout() {
    // Invalidate refresh token server-side first (best-effort)
    try {
      await httpPost('/auth/logout', {});
    } catch {
      // Server may be unreachable — continue with local cleanup
    }
    clearAuthToken();
    try {
      if (Platform.OS === 'web') {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      if (__DEV__) console.warn('[auth] Failed to clear tokens from secure storage:', error);
    }
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
  async refreshToken(): Promise<string | null> {
    const stored = await loadRefreshToken();
    if (!stored) return null;

    const timeoutMs = 15000; // 15s — align with auth endpoint timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        await auth.logout();
        return null;
      }

      const { access_token, refresh_token } = await res.json();
      await saveToken(access_token);
      await saveRefreshToken(refresh_token);
      return access_token;
    } catch (error) {
      clearTimeout(timeoutId);
      if (__DEV__) console.error('[auth] Token refresh failed:', error);
      await auth.logout();
      return null;
    }
  },
  getToken: loadToken,
};

export default auth;
