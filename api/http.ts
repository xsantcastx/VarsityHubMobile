import { Platform } from 'react-native';

let tokenCache: string | null = null;
export function setAuthToken(token: string | null) { tokenCache = token || null; }
export function clearAuthToken() { tokenCache = null; }
export function getAuthToken(): string | null { return tokenCache; }

export function getApiBaseUrl(): string {
  // Expo packs env vars under process.env at runtime
  const envUrl = (typeof process !== 'undefined' && (process as any).env && (process as any).env.EXPO_PUBLIC_API_URL) || '';
  const defaultUrl = __DEV__ ? 'http://localhost:4000' : 'https://api-production-8ac3.up.railway.app';
  let url = envUrl || defaultUrl;
  if (__DEV__ && Platform.OS === 'android' && url.startsWith('http://localhost')) {
    url = url.replace('http://localhost', 'http://10.0.2.2');
  }
  const finalUrl = url.replace(/\/$/, '');
  console.log('[API] Using base URL:', finalUrl);
  return finalUrl;
}

function getBaseUrl(): string {
  return getApiBaseUrl();
}

async function request(path: string, options: RequestInit = {}, timeoutMs: number = 30000): Promise<any> {
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
    const res = await fetch(base + path, { 
      ...options, 
      headers,
      signal: controller.signal 
    });
    clearTimeout(timeoutId);

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
    if (error.name === 'AbortError') {
      const err: any = new Error('Request timeout - server did not respond');
      err.status = 408;
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
