import { getConfig, getEnvValue } from '@/config/env';
import { captureBreadcrumb, captureException } from '@/utils/sentry';
import { Platform } from 'react-native';

let tokenCache: string | null = null;
export function setAuthToken(token: string | null) { tokenCache = token || null; }
export function clearAuthToken() { tokenCache = null; }
export function getAuthToken(): string | null { return tokenCache; }

export function getApiBaseUrl(): string {
  const config = getConfig();
  const envUrl = getEnvValue('EXPO_PUBLIC_API_URL');
  const forceRemote = config.forceRemoteApi;
  const PRODUCTION_URL = 'https://api-production-8ac3.up.railway.app';
  
  // Always use Railway production server - easier to manage
  // If forceRemote is true or we have a configured URL, use it; otherwise use production
  let url = forceRemote ? (envUrl || PRODUCTION_URL) : (config.apiUrl || envUrl || PRODUCTION_URL);
  
  // Ensure we always use Railway production in production mode
  if (config.nodeEnv === 'production' || forceRemote) {
    url = envUrl || PRODUCTION_URL;
  }
  
  // Handle simulator networking (only for actual localhost in dev mode)
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
  
  // Safeguard: If URL is a private IP (not localhost/127.0.0.1/10.0.2.2), fall back to production
  const isAllowedLocalIP = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('10.0.2.2');
  const isPrivateIP = /^http:\/\/192\.168\.\d+\.\d+/.test(url) || 
    (/^http:\/\/10\.\d+\.\d+\.\d+/.test(url) && !url.includes('10.0.2.2')) ||
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/.test(url);
  if (isPrivateIP && !isAllowedLocalIP) {
    console.warn('[http] Detected cached private IP URL:', url, '- Falling back to Railway production URL');
    url = PRODUCTION_URL;
  }
  
  const finalUrl = url.replace(/\/$/, '');
  
  if (__DEV__ && !('__VH_LOGGED_API_BASE' in (globalThis as any))) {
    (globalThis as any).__VH_LOGGED_API_BASE = true;
    // eslint-disable-next-line no-console
    console.log('[http] API base:', finalUrl, { envUrl, forceRemote, platform: Platform.OS, nodeEnv: config.nodeEnv });
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
      // Clear token on auth errors and let AuthProvider handle session loss
      if (err.status === 401 || err.status === 403) {
        try { clearAuthToken(); } catch {}
        // Don't router.push here; AuthProvider will redirect if user is truly unauthenticated.
      }
      throw err;
    }
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Suppress verbose logging for expected auth errors in dev mode
    const isAuthError = path.includes('/auth/') || path.includes('/me');
    const isExpectedDevError = __DEV__ && isAuthError && (error.status === 401 || error.status === 408 || error.status === 400);
    
    // Suppress logging for known missing endpoints
    const isKnownMissingEndpoint = 
      path.includes('/geocoding/autocomplete') || 
      path.includes('/posts/trending') ||
      (path.includes('/users') && error.status === 403) ||
      (path.includes('/notifications') && error.status === 401);
    
    // Enhanced error logging with more context
    if (!isExpectedDevError && !isKnownMissingEndpoint) {
      const errorDetails = {
        url: base + path,
        method: options.method || 'GET',
        status: error.status,
        message: error.message,
        name: error.name,
        ...(error.data && { responseData: error.data }),
      };
      console.error('[http] Request failed:', errorDetails);
    }
    
    // Handle 429 Rate Limit errors with retry
    if (error.status === 429) {
      const retryAfter = error.data?.retryAfter || 5; // Default 5 seconds
      if (retries > 0) {
        // Wait for retryAfter seconds before retrying
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return request(path, options, timeoutMs, retries - 1);
      }
      // If no retries left, throw user-friendly error
      const err: any = new Error(error.data?.message || 'Too many requests, please try again later.');
      err.status = 429;
      err.data = error.data;
      throw err;
    }
    
    if (error.name === 'AbortError') {
      const err: any = new Error('Request timeout - server did not respond');
      err.status = 408;
      if (!isExpectedDevError) {
        captureException(err, { path, base, timeoutMs, method: options.method || 'GET' });
      }
      // Retry once on timeout if allowed
      if (retries > 0) {
        // Exponential backoff: small delay before retry
        await new Promise(r => setTimeout(r, Math.min(1000, timeoutMs * 0.1)));
        return request(path, options, timeoutMs, retries - 1);
      }
      throw err;
    }
    
    // Add more context to network errors with better retry logic
    if (error.message === 'Network request failed' || error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
      const err: any = new Error(`Cannot connect to server. Please check your internet connection and try again.`);
      err.originalError = error;
      err.status = 0;
      err.isNetworkError = true;
      if (!isExpectedDevError && !isKnownMissingEndpoint) {
        captureException(err, { path, base, method: options.method || 'GET', isNetworkError: true });
      }
      // Retry network errors with exponential backoff
      if (retries > 0) {
        const delay = Math.min(2000, 500 * Math.pow(2, 1 - retries)); // Exponential backoff
        await new Promise(r => setTimeout(r, delay));
        return request(path, options, timeoutMs, retries - 1);
      }
      throw err;
    }
    if (!isExpectedDevError && !isKnownMissingEndpoint) {
      captureException(error, { path, base, method: options.method || 'GET' });
    }
    throw error;
  }
}

export function httpGet(path: string, options: RequestInit = {}) {
  // Allow 2 retries for GET requests (helps with rate limits and network errors)
  return request(path, { ...options, method: 'GET' }, 30000, 2);
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
