import { Platform } from 'react-native';

let tokenCache: string | null = null;
export function setAuthToken(token: string | null) { tokenCache = token || null; }
export function clearAuthToken() { tokenCache = null; }
export function getAuthToken(): string | null { return tokenCache; }

export function getApiBaseUrl(): string {
  // Expo packs env vars under process.env at runtime
  const env = (typeof process !== 'undefined' ? (process as any).env || {} : {}) as any;
  const envUrl = (env && env.EXPO_PUBLIC_API_URL) || '';
  const forceRemote = String(env?.EXPO_PUBLIC_FORCE_REMOTE_API || '').toLowerCase() === 'true';

  // In development, use the env URL if provided, otherwise fall back to production
  let url: string;
  if (__DEV__ && !forceRemote) {
    // Always use EXPO_PUBLIC_API_URL if provided (supports localhost, LAN IPs, etc.)
    url = envUrl || 'http://localhost:4000';
  } else {
    const defaultUrl = 'https://api-production-8ac3.up.railway.app';
    url = envUrl || defaultUrl;
  }
  
  // On iOS simulator, `localhost` will automatically resolve to the host machine.
  // On Android, it needs to be explicitly mapped to `10.0.2.2`.
  if (__DEV__ && url.startsWith('http://localhost')) {
    if (Platform.OS === 'android') {
      // Android simulator uses 10.0.2.2 to reach host machine
      url = url.replace('http://localhost', 'http://10.0.2.2');
    }
  }
  
  const finalUrl = url.replace(/\/$/, '');
  if (__DEV__ && !('__VH_LOGGED_API_BASE' in (global as any))) {
    (global as any).__VH_LOGGED_API_BASE = true;
    // eslint-disable-next-line no-console
    console.log('[http] API base:', finalUrl, { envUrl, forceRemote, platform: Platform.OS });
  }
  return finalUrl;
}

function getBaseUrl(): string {
  return getApiBaseUrl();
}

async function request(path: string, options: RequestInit = {}, timeoutMs: number = 60000): Promise<any> {
  const base = getBaseUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Avoid stale caches/Etags for personalized endpoints
  if (/^\/(me|auth\/me|rsvps|follows|support|users|teams|team-memberships|team-invites)/.test(path)) {
    headers['Cache-Control'] = headers['Cache-Control'] || 'no-store';
    headers['Pragma'] = headers['Pragma'] || 'no-cache';
    headers['If-None-Match'] = headers['If-None-Match'] || '';
  }

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // HTTP request initiated
    const res = await fetch(base + path, { 
      ...options, 
      headers,
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    // HTTP response received

    // Handle 304 Not Modified: return a special object or null.
    // The caller can then decide whether to use cached data or ignore.
    if (res.status === 304) {
      return { _status: 304, _isNotModified: true };
    }

    const text = await res.text();
    const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
    let data: any = null;
    if (ct.includes('application/json')) {
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
    } else {
      data = text; // plain text or HTML
    }

    if (!res.ok) {
      const msg = ct.includes('application/json') ? (data && (data.error || data.message)) : (typeof data === 'string' ? data : null);
      const err: any = new Error(msg || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn('[http] Request failed:', { url: base + path, error: error.message });
    if (error.name === 'AbortError') {
      // Don't re-throw AbortError, just return null to the caller.
      // The caller should handle the null response gracefully.
      return null;
    }
    // Add more context to network errors
    if (error.message === 'Network request failed') {
      const err: any = new Error(`Cannot connect to server at ${base}. Make sure the backend is running.`);
      err.originalError = error;
      err.status = 0;
      throw err;
    }
    throw error;
  }
}

export function httpGet(path: string, options: RequestInit = {}) {
  return request(path, { ...options, method: 'GET' });
}
export function httpPost(path: string, body?: any) { return request(path, { method: 'POST', body: JSON.stringify(body || {}) }); }
export function httpPostLongTimeout(path: string, body?: any) { return request(path, { method: 'POST', body: JSON.stringify(body || {}) }, 60000); }
export function httpPut(path: string, body?: any) { return request(path, { method: 'PUT', body: JSON.stringify(body || {}) }); }
export function httpPatch(path: string, body?: any) { return request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }); }
export function httpDelete(path: string, body?: any) {
  const payload = typeof body === 'undefined' ? undefined : JSON.stringify(body);
  const options: RequestInit = payload ? { method: 'DELETE', body: payload } : { method: 'DELETE' };
  return request(path, options);
}
