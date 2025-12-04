import { captureBreadcrumb, captureException } from '@/utils/sentry';
import { router } from 'expo-router';
import { Platform } from 'react-native';

let tokenCache: string | null = null;
export function setAuthToken(token: string | null) { tokenCache = token || null; }
export function clearAuthToken() { tokenCache = null; }
export function getAuthToken(): string | null { return tokenCache; }

export function getApiBaseUrl(): string {
  // Expo packs env vars under process.env at runtime
  const env = (typeof process !== 'undefined' ? (process as any).env || {} : {}) as any;
  const envUrl = (env && env.EXPO_PUBLIC_API_URL) || '';
  // Default to forcing remote API unless explicitly disabled
  const forceRemote = String(env?.EXPO_PUBLIC_FORCE_REMOTE_API ?? 'true').toLowerCase() === 'true';

  // In development, use the env URL if provided, otherwise fall back to production
  let url: string;
  // Prefer remote API by default to avoid 127.0.0.1 issues on device
  const defaultUrl = 'https://api-production-8ac3.up.railway.app';
  if (__DEV__ && !forceRemote) {
    // Dev may point to local if explicitly allowed and provided
    url = envUrl || defaultUrl;
  } else {
    url = envUrl || defaultUrl;
  }
  
  // Handle simulator networking (only for actual localhost, not LAN IPs)
  if (__DEV__ && !forceRemote && url.startsWith('http://localhost')) {
    if (Platform.OS === 'android') {
      // Android simulator uses 10.0.2.2 to reach host machine
      url = url.replace('http://localhost', 'http://10.0.2.2');
    }
    if (Platform.OS === 'ios') {
      // iOS simulator can use 127.0.0.1 for localhost
      url = url.replace('http://localhost', 'http://127.0.0.1');
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

async function request(path: string, options: RequestInit = {}, timeoutMs: number = 30000, retries: number = 0): Promise<any> {
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
    captureBreadcrumb(`HTTP ${options.method || 'GET'} ${path}`, 'http', { base, path, hasAuth: !!token });
    const res = await fetch(base + path, { 
      ...options, 
      headers,
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    // HTTP response received
    captureBreadcrumb(`HTTP ${res.status} ${path}`, 'http', { status: res.status, path });

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
      } catch (_error) {
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
      // Auth-aware redirect for protected endpoints
      if (err.status === 401 || err.status === 403) {
        // clear token cache and route to sign-in preserving next
        try { clearAuthToken(); } catch (_error) {}
        const next = encodeURIComponent(path);
        try { router.push(`/sign-in?next=${next}` as any); } catch (_error) {}
      }
      throw err;
    }
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[http] Request failed:', { url: base + path, error: error.message });
    if (error.name === 'AbortError') {
      const err: any = new Error('Request timeout - server did not respond');
      err.status = 408;
      captureException(err, { path, base, timeoutMs, method: options.method || 'GET' });
      // Retry once on timeout if allowed
      if (retries > 0) {
        // Exponential backoff: small delay before retry
        await new Promise(r => setTimeout(r, Math.min(1000, timeoutMs * 0.1)));
        return request(path, options, timeoutMs, retries - 1);
      }
      throw err;
    }
    // Add more context to network errors
    if (error.message === 'Network request failed') {
      const err: any = new Error(`Cannot connect to server at ${base}. Make sure the backend is running.`);
      err.originalError = error;
      err.status = 0;
      captureException(err, { path, base, method: options.method || 'GET' });
      if (retries > 0) {
        await new Promise(r => setTimeout(r, Math.min(1000, timeoutMs * 0.1)));
        return request(path, options, timeoutMs, retries - 1);
      }
      throw err;
    }
    captureException(error, { path, base, method: options.method || 'GET' });
    throw error;
  }
}

export function httpGet(path: string, options: RequestInit = {}) {
  return request(path, { ...options, method: 'GET' });
}
// Default POST with moderate timeout
export function httpPost(path: string, body?: any) { return request(path, { method: 'POST', body: JSON.stringify(body || {}) }, 15000, 1); }
// Long-timeout POST for heavy endpoints like register/reset
export function httpPostLongTimeout(path: string, body?: any) { return request(path, { method: 'POST', body: JSON.stringify(body || {}) }, 60000, 1); }
export function httpPut(path: string, body?: any) { return request(path, { method: 'PUT', body: JSON.stringify(body || {}) }); }
export function httpPatch(path: string, body?: any) { return request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }); }
export function httpDelete(path: string, body?: any) {
  const payload = typeof body === 'undefined' ? undefined : JSON.stringify(body);
  const options: RequestInit = payload ? { method: 'DELETE', body: payload } : { method: 'DELETE' };
  return request(path, options);
}
