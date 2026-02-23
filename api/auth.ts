import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { clearAuthToken, getAuthToken, httpGet, httpPost, httpPostLongTimeout, setAuthToken, setOn401Handler } from './http';

// Storage key for authentication token (not a secret itself, just a key name)
const TOKEN_KEY = 'auth_token_key';
const REFRESH_TOKEN_KEY = 'auth_refresh_token_key';

/** Clear token from memory and SecureStore. Called on 401/403 so expired token is never reused. */
export async function clearPersistedToken(): Promise<void> {
  clearAuthToken();
  try {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch {}
}

/** Try to refresh access token using refresh_token. Returns new access_token or null. */
export async function tryRefreshToken(): Promise<string | null> {
  let refreshToken: string | null = null;
  try {
    if (Platform.OS === 'web') refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    else refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {}
  if (!refreshToken) return null;
  const base = (await import('./http')).getApiBaseUrl();
  try {
    const res = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; refresh_token?: string };
    if (data?.access_token) {
      await saveToken(data.access_token);
      if (data?.refresh_token) await saveRefreshToken(data.refresh_token);
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

const SESSION_EXPIRED_KEY = '@session_expired';

/** Called when 401/403 refresh fails. Use to show message and redirect. */
let onSessionExpiredCallback: (() => void) | null = null;

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpiredCallback = cb;
}

/** Check if user was redirected due to session expiry (clears flag). */
export async function consumeSessionExpiredFlag(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const v = window.localStorage.getItem(SESSION_EXPIRED_KEY);
      window.localStorage.removeItem(SESSION_EXPIRED_KEY);
      return v === '1';
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const v = await AsyncStorage.getItem(SESSION_EXPIRED_KEY);
    await AsyncStorage.removeItem(SESSION_EXPIRED_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

// On 401/403: try refresh; if success retry request, else clear and fail
setOn401Handler(async () => {
  const newToken = await tryRefreshToken();
  if (newToken) return true;
  await clearPersistedToken();
  // Mark session expired so sign-in can show message
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(SESSION_EXPIRED_KEY, '1');
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(SESSION_EXPIRED_KEY, '1');
    }
  } catch {}
  onSessionExpiredCallback?.();
  return false;
});

async function saveToken(token: string | null) {
  setAuthToken(token);
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(TOKEN_KEY, token || '');
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token || '');
    }
  } catch {}
}

async function saveRefreshToken(token: string | null) {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token || '');
    } else {
      if (token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch {}
}

export async function loadToken(): Promise<string | null> {
  const cached = getAuthToken();
  if (cached) return cached;
  let t: string | null = null;
  try {
    if (Platform.OS === 'web') t = window.localStorage.getItem(TOKEN_KEY);
    else t = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {}
  if (t) setAuthToken(t);
  return t;
}

export const auth = {
  async register(email: string, password: string, display_name?: string) {
    const res = await httpPostLongTimeout('/auth/register', { email, password, display_name });
    const r = res as any;
    if (r?.access_token) {
      await saveToken(r.access_token);
      if (r?.refresh_token) await saveRefreshToken(r.refresh_token);
    }
    return res;
  },
  async login(email: string, password: string) {
    const res = await httpPost('/auth/login', { email, password });
    if (res?.access_token) {
      await saveToken(res.access_token);
      if ((res as any)?.refresh_token) await saveRefreshToken((res as any).refresh_token);
    }
    return res;
  },
  async loginWithGoogle(idToken: string) {
    const res = await httpPost('/auth/google', { id_token: idToken });
    if (res?.access_token) {
      await saveToken(res.access_token);
      if ((res as any)?.refresh_token) await saveRefreshToken((res as any).refresh_token);
    }
    return res;
  },
  async loginWithApple(identityToken: string) {
    const res = await httpPostLongTimeout('/auth/apple', { identity_token: identityToken });
    if (res?.access_token) {
      await saveToken(res.access_token);
      if ((res as any)?.refresh_token) await saveRefreshToken((res as any).refresh_token);
    }
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
      // Only clear session on explicit unauthenticated (401).
      if (e && e.status === 401) {
        try { await auth.logout(); } catch {}
      }
      throw e;
    }
  },
  async logout() {
    await clearPersistedToken();
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
