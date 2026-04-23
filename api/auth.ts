import AsyncStorage from '@react-native-async-storage/async-storage';
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
const REFRESH_TOKEN_KEY = 'refresh_token_key';
const FRESH_INSTALL_KEY = '@varsityhub_installed';

// ── User.me() client-side TTL cache ──────────────────────────────────
// Caches the /me response for up to 30 seconds to cut redundant GETs.
// Invalidated explicitly on login, logout, register, verify-email,
// onboarding completion, plan change, and profile update.
const ME_CACHE_TTL_MS = 30_000;
let _meCacheData: any = null;
let _meCacheTs = 0;

/** Force the next User.me() call to hit the network. */
export function invalidateMeCache() {
  _meCacheData = null;
  _meCacheTs = 0;
}

/**
 * Clear stale Keychain tokens on fresh install.
 * iOS Keychain persists across app delete/reinstall, but AsyncStorage does not.
 * If the AsyncStorage flag is missing, this is a fresh install and we clear old tokens.
 */
export async function clearStaleTokensOnFreshInstall(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const installed = await AsyncStorage.getItem(FRESH_INSTALL_KEY);
    if (!installed) {
      // Fresh install — clear any leftover Keychain tokens from previous install
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
      clearAuthToken();
      await AsyncStorage.setItem(FRESH_INSTALL_KEY, 'true');
    }
  } catch {
    // Silently fail — worst case user stays logged in
  }
}

function getWebSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getWebLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readWebToken(key: string): string | null {
  const session = getWebSessionStorage();
  const sessionValue = session?.getItem(key) ?? null;
  if (sessionValue) return sessionValue;

  // One-time migration from legacy localStorage to sessionStorage.
  const local = getWebLocalStorage();
  const legacyValue = local?.getItem(key) ?? null;
  if (legacyValue && session) {
    try {
      session.setItem(key, legacyValue);
      local?.removeItem(key);
    } catch {
      // Best-effort migration only.
    }
  }
  return legacyValue;
}

function clearWebToken(key: string) {
  try {
    getWebSessionStorage()?.removeItem(key);
  } catch {
    // no-op
  }
  try {
    getWebLocalStorage()?.removeItem(key);
  } catch {
    // no-op
  }
}

function clearLegacyWebToken(key: string) {
  try {
    getWebLocalStorage()?.removeItem(key);
  } catch {
    // no-op
  }
}

type AuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  verification_email_sent?: boolean;
  verification_email_error?: string;
};

export type RefreshTokenResult =
  | { accessToken: string; reason: 'success' }
  | { accessToken: null; reason: 'missing' | 'auth' | 'network' | 'unknown'; error?: unknown };

function parseAuthTokenResponse(value: unknown): AuthTokenResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid auth response');
  }

  const response = value as Record<string, unknown>;
  const parsed: AuthTokenResponse = {};
  if (typeof response.access_token === 'string') parsed.access_token = response.access_token;
  if (typeof response.refresh_token === 'string') parsed.refresh_token = response.refresh_token;
  if (typeof response.verification_email_sent === 'boolean') {
    parsed.verification_email_sent = response.verification_email_sent;
  }
  if (typeof response.verification_email_error === 'string') {
    parsed.verification_email_error = response.verification_email_error;
  }
  return parsed;
}

async function saveToken(token: string | null) {
  setAuthToken(token);
  try {
    if (Platform.OS === 'web') {
      const session = getWebSessionStorage();
      if (token) {
        if (session) session.setItem(TOKEN_KEY, token);
      } else {
        clearWebToken(TOKEN_KEY);
      }
      clearLegacyWebToken(TOKEN_KEY);
    } else {
      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (error) {
    if (__DEV__) console.error('[auth] Failed to save token to secure storage:', error);
  }
}

async function saveRefreshToken(token: string | null) {
  try {
    if (Platform.OS === 'web') {
      const session = getWebSessionStorage();
      if (token) {
        if (session) session.setItem(REFRESH_TOKEN_KEY, token);
      } else {
        clearWebToken(REFRESH_TOKEN_KEY);
      }
      // Ensure no legacy refresh token remains in persistent storage.
      clearLegacyWebToken(REFRESH_TOKEN_KEY);
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
    if (Platform.OS === 'web') return readWebToken(REFRESH_TOKEN_KEY);
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
    if (Platform.OS === 'web') t = readWebToken(TOKEN_KEY);
    else t = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    if (__DEV__) console.error('[auth] Failed to load token from secure storage:', error);
  }
  if (t) setAuthToken(t);
  return t;
}

/** Clear tokens locally only (no server call). Use before OAuth so the new provider’s token is the only one in use. */
export const auth = {
  async clearTokensOnly() {
    invalidateMeCache();
    clearAuthToken();
    try {
      if (Platform.OS === 'web') {
        clearWebToken(TOKEN_KEY);
        clearWebToken(REFRESH_TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      if (__DEV__) console.warn('[auth] Failed to clear tokens from storage:', error);
    }
  },
  async register(email: string, password: string, display_name?: string) {
    invalidateMeCache();
    const res = parseAuthTokenResponse(
      await httpPostLongTimeout('/auth/register', { email, password, display_name })
    );
    if (res.access_token) await saveToken(res.access_token);
    if (res.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async login(email: string, password: string) {
    invalidateMeCache();
    const res = await httpPost('/auth/login', { email, password });
    if (res?.access_token) await saveToken(res.access_token);
    if (res?.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async loginWithGoogle(idToken: string) {
    invalidateMeCache();
    // Google auth involves server-side token verification with Google — allow longer timeout
    const res = await httpPostLongTimeout('/auth/google', { id_token: idToken });
    if (res?.access_token) await saveToken(res.access_token);
    if (res?.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async loginWithApple(identityToken: string) {
    invalidateMeCache();
    // Apple auth can be slow on real devices; allow longer timeout
    const res = await httpPostLongTimeout('/auth/apple', { identity_token: identityToken });
    if (res?.access_token) await saveToken(res.access_token);
    if (res?.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async me(config?: { force?: boolean }) {
    if (config?.force) {
      invalidateMeCache();
    }
    // Return cached response if still fresh (30 s TTL)
    if (_meCacheData && Date.now() - _meCacheTs < ME_CACHE_TTL_MS) {
      return _meCacheData;
    }
    const token = await loadToken();
    if (!token) {
      invalidateMeCache();
      return null;
    }
    const requestOptions = {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'If-None-Match': '',
      },
    };
    const data = await httpGet('/me', requestOptions);
    if (data && !data.error) {
      _meCacheData = data;
      _meCacheTs = Date.now();
    }
    return data;
  },
  async logout() {
    invalidateMeCache();
    // Invalidate refresh token server-side first (best-effort)
    try {
      const refreshToken = await loadRefreshToken();
      await httpPost('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {});
    } catch {
      // Server may be unreachable — continue with local cleanup
    }
    clearAuthToken();
    try {
      if (Platform.OS === 'web') {
        clearWebToken(TOKEN_KEY);
        clearWebToken(REFRESH_TOKEN_KEY);
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
    invalidateMeCache();
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
  async refreshToken(): Promise<RefreshTokenResult> {
    const stored = await loadRefreshToken();
    if (!stored) return { accessToken: null, reason: 'missing' };

    try {
      const response = parseAuthTokenResponse(
        await httpPost('/auth/refresh', { refresh_token: stored }, { skipAuthRetry: true })
      );
      const { access_token, refresh_token } = response;
      if (!access_token) {
        await saveToken(null);
        await saveRefreshToken(null);
        return { accessToken: null, reason: 'auth' };
      }
      await saveToken(access_token);
      await saveRefreshToken(refresh_token ?? null);
      return { accessToken: access_token, reason: 'success' };
    } catch (error: any) {
      if (__DEV__) console.error('[auth] Token refresh failed:', error);
      if (error?.status === 401 || error?.status === 403) {
        await saveToken(null);
        await saveRefreshToken(null);
        return { accessToken: null, reason: 'auth', error };
      }
      if (
        error?.status === 0 ||
        error?.status === 408 ||
        error?.status === 502 ||
        error?.status === 503 ||
        error?.isNetworkError ||
        error?.isTransientAuthError
      ) {
        return { accessToken: null, reason: 'network', error };
      }
      return { accessToken: null, reason: 'unknown', error };
    }
  },
  getToken: loadToken,
};

export default auth;
