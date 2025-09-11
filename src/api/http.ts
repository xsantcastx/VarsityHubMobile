import { Platform } from 'react-native';

let tokenCache: string | null = null;
export function setAuthToken(token: string | null) { tokenCache = token || null; }
export function clearAuthToken() { tokenCache = null; }
export function getAuthToken(): string | null { return tokenCache; }

function getBaseUrl(): string {
  // Expo packs env vars under process.env at runtime
  const envUrl = (typeof process !== 'undefined' && (process as any).env && (process as any).env.EXPO_PUBLIC_API_URL) || '';
  let url = envUrl || 'http://localhost:4000';
  if (Platform.OS === 'android' && url.startsWith('http://localhost')) {
    url = url.replace('http://localhost', 'http://10.0.2.2');
  }
  return url.replace(/\/$/, '');
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const base = getBaseUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(base + path, { ...options, headers });
  const text = await res.text();
  const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
  let data: any = null;
  if (ct.includes('application/json')) {
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  } else {
    data = text; // plain text or HTML
  }
  if (!res.ok) {
    const msg = ct.includes('application/json') ? (data && (data.error || data.message)) : (typeof data === 'string' ? data : null);
    const err: any = new Error(msg || `HTTP ${res.status}`);
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}

export function httpGet(path: string) { return request(path, { method: 'GET' }); }
export function httpPost(path: string, body?: any) { return request(path, { method: 'POST', body: JSON.stringify(body || {}) }); }
export function httpPut(path: string, body?: any) { return request(path, { method: 'PUT', body: JSON.stringify(body || {}) }); }
