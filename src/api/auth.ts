import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { httpGet, httpPost, setAuthToken, clearAuthToken, getAuthToken } from './http';

const TOKEN_KEY = 'vh_access_token';

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
  async login(email: string, password: string) {
    const res = await httpPost('/auth/login', { email, password });
    if (res?.access_token) await saveToken(res.access_token);
    return res;
  },
  async me() {
    await loadToken();
    return httpGet('/me');
  },
  async logout() {
    clearAuthToken();
    try {
      if (Platform.OS === 'web') window.localStorage.removeItem(TOKEN_KEY);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {}
  },
  getToken: loadToken,
};

export default auth;

