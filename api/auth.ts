import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { clearAuthToken, getAuthToken, httpGet, httpPost, httpPostLongTimeout, setAuthToken } from './http';

// Storage key for authentication token (not a secret, just the key name)
const TOKEN_KEY = 'auth_token_key';

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
    return res;
  },
  async login(email: string, password: string) {
    const res = await httpPost('/auth/login', { email, password });
    if (res?.access_token) await saveToken(res.access_token);
    return res;
  },
  async loginWithGoogle(idToken: string) {
    const res = await httpPost('/auth/google', { id_token: idToken });
    if (res?.access_token) await saveToken(res.access_token);
    return res;
  },
  async loginWithApple(identityToken: string) {
    // Apple auth can be slow on real devices; allow longer timeout
    const res = await httpPostLongTimeout('/auth/apple', { identity_token: identityToken });
    if (res?.access_token) await saveToken(res.access_token);
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
          console.warn('[auth] Cleanup logout failed:', logoutError);
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
};

export default auth;
