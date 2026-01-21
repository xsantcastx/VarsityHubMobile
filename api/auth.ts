import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { clearAuthToken, getAuthToken, httpGet, httpPost, httpPostLongTimeout, setAuthToken } from './http';

// Storage key for authentication token (not a secret itself, just a key name)
const TOKEN_KEY = 'auth_token_key';

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:47',message:'loginWithApple called',data:{hasToken:!!identityToken},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Apple auth can be slow on real devices; allow longer timeout
    const res = await httpPostLongTimeout('/auth/apple', { identity_token: identityToken });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:50',message:'loginWithApple API response',data:{hasAccessToken:!!res?.access_token,responseKeys:Object.keys(res||{})},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (res?.access_token) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:52',message:'Saving access token',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      await saveToken(res.access_token);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/41b116d6-d712-458a-b639-8da7c3c9e7c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:54',message:'Token saved',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
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
    clearAuthToken();
    try {
      if (Platform.OS === 'web') window.localStorage.removeItem(TOKEN_KEY);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {}
  },
  async requestEmailVerification() {
    await loadToken();
    return httpPost('/auth/verify/request', {});
  },
  async verifyEmail(code: string) {
    await loadToken();
    return httpPost('/auth/verify/confirm', { code });
  },
  async requestPhoneVerification(phone: string) {
    await loadToken();
    return httpPost('/auth/verify/phone/request', { phone });
  },
  async verifyPhone(phone: string, code: string) {
    await loadToken();
    return httpPost('/auth/verify/phone/confirm', { phone, code });
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
