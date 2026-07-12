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
import { validateAuthenticatedUser } from './schemas/auth';

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

export type FreshInstallCleanupResult = {
  freshInstall: boolean;
  ok: boolean;
  error?: unknown;
};

/**
 * Clear stale Keychain tokens on fresh install.
 * iOS Keychain persists across app delete/reinstall, but AsyncStorage does not.
 * If the AsyncStorage flag is missing, this is a fresh install and we clear old tokens.
 *
 * Fail closed: if cleanup cannot complete, clear in-memory auth state and
 * return `ok: false` so bootstrap can avoid trusting persisted identity.
 */
export async function clearStaleTokensOnFreshInstall(): Promise<FreshInstallCleanupResult> {
  if (Platform.OS === 'web') return { freshInstall: false, ok: true };

  try {
    const installed = await AsyncStorage.getItem(FRESH_INSTALL_KEY);
    if (installed) {
      return { freshInstall: false, ok: true };
    }

    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    clearAuthToken();
    invalidateMeCache();
    await AsyncStorage.setItem(FRESH_INSTALL_KEY, 'true');
    return { freshInstall: true, ok: true };
  } catch (error) {
    clearAuthToken();
    invalidateMeCache();
    if (__DEV__) {
      console.warn(
        '[auth] Fresh install token cleanup failed; forcing signed-out bootstrap:',
        error
      );
    }
    return { freshInstall: true, ok: false, error };
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
  needs_verification?: boolean;
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
  if (typeof response.needs_verification === 'boolean') {
    parsed.needs_verification = response.needs_verification;
  }
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

/** Clear tokens locally only (no server call). Used for logout/session-expiry cleanup, never for silent account replacement. */
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
  async register(email: string, password: string, display_name?: string, dob?: string) {
    invalidateMeCache();
    // omitAuthToken: register must not inherit a stale bearer token from a
    // previous session on the device. skipAuthRetry: auth-establishing
    // endpoint — see login() for rationale.
    const res = parseAuthTokenResponse(
      await httpPostLongTimeout(
        '/auth/register',
        { email, password, display_name, dob },
        {
          omitAuthToken: true,
          skipAuthRetry: true,
        }
      )
    );
    if (res.access_token) await saveToken(res.access_token);
    if (res.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async login(email: string, password: string) {
    invalidateMeCache();
    // parseAuthTokenResponse validates the shape and throws "Invalid auth
    // response" on null/undefined/array/scalar — without it, an unexpected
    // response (proxy returning HTML, network shim returning string,
    // future API contract drift) silently no-ops the token save and
    // returns whatever the response was, leaving the caller in a half-
    // signed-in state.
    // omitAuthToken: /auth/login is establishing identity and must not send
    // a stale bearer token from an earlier session. skipAuthRetry: a stale
    // access token in memory must NOT trigger the global 401-refresh path on
    // a sign-in request. A wrong-password 401 has to surface as itself, not
    // get swallowed into refresh-token rotation when the device happens to be
    // carrying a leftover token.
    const res = parseAuthTokenResponse(
      await httpPost(
        '/auth/login',
        { email, password },
        {
          omitAuthToken: true,
          skipAuthRetry: true,
        }
      )
    );
    if (res.access_token) await saveToken(res.access_token);
    if (res.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async loginWithGoogle(idToken: string) {
    invalidateMeCache();
    // Google auth involves server-side token verification with Google — allow
    // longer timeout. omitAuthToken/skipAuthRetry: same reason as login —
    // auth-establishing endpoints must not inherit stale bearer state or be
    // re-tried through the refresh machinery.
    const res = parseAuthTokenResponse(
      await httpPostLongTimeout(
        '/auth/google',
        { id_token: idToken },
        {
          omitAuthToken: true,
          skipAuthRetry: true,
        }
      )
    );
    if (res.access_token) await saveToken(res.access_token);
    if (res.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async loginWithApple(identityToken: string) {
    invalidateMeCache();
    // Apple auth can be slow on real devices; allow longer timeout.
    // omitAuthToken/skipAuthRetry: same reason as login — auth-establishing
    // endpoints must not inherit stale bearer state or be re-tried through
    // the refresh machinery.
    const res = parseAuthTokenResponse(
      await httpPostLongTimeout(
        '/auth/apple',
        { identity_token: identityToken },
        {
          omitAuthToken: true,
          skipAuthRetry: true,
        }
      )
    );
    if (res.access_token) await saveToken(res.access_token);
    if (res.refresh_token) await saveRefreshToken(res.refresh_token);
    return res;
  },
  async linkGoogle(idToken: string) {
    invalidateMeCache();
    return httpPostLongTimeout('/auth/google/link', { id_token: idToken });
  },
  async linkApple(identityToken: string) {
    invalidateMeCache();
    return httpPostLongTimeout('/auth/apple/link', { identity_token: identityToken });
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
    const data = validateAuthenticatedUser('/me', await httpGet('/me', requestOptions));
    _meCacheData = data;
    _meCacheTs = Date.now();
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
  async deleteAccount(payload?: { password?: string; delete_confirmation?: string }) {
    invalidateMeCache();
    await loadToken();
    return httpPost('/auth/account/delete', payload || {});
  },
  async refreshToken(): Promise<RefreshTokenResult> {
    const stored = await loadRefreshToken();
    if (!stored) return { accessToken: null, reason: 'missing' };

    try {
      const response = parseAuthTokenResponse(
        await httpPost(
          '/auth/refresh',
          { refresh_token: stored },
          {
            omitAuthToken: true,
            skipAuthRetry: true,
          }
        )
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
