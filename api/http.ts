import { Platform } from 'react-native';

let tokenCache: string | null = null;
export function setAuthToken(token: string | null) { tokenCache = token || null; }
export function clearAuthToken() { tokenCache = null; }
export function getAuthToken(): string | null { return tokenCache; }

// Optional refresh handler that can be registered by auth.ts
export type RefreshHandler = () => Promise<boolean>;
let refreshHandler: RefreshHandler | null = null;
export function setRefreshHandler(fn: RefreshHandler | null) { refreshHandler = fn; }

const DEFAULT_REMOTE_API_URL = 'https://api-production-8ac3.up.railway.app';
const DEFAULT_LOCAL_API_URL = 'http://localhost:4000';

type ApiBaseState = {
  current: string;
  fallback: string | null;
  envUrl: string | null;
  forceRemote: boolean;
  preferLocalFallback: boolean;
  usedLocalDefault: boolean;
};

let apiBaseState: ApiBaseState | null = null;

function sanitizeUrl(url: string) {
  if (!url) return '';
  return url.replace(/\/$/, '');
}

function resolveApiBaseState(): ApiBaseState {
  const env = (typeof process !== 'undefined' ? (process as any).env || {} : {}) as any;
  const envUrlRaw = typeof env?.EXPO_PUBLIC_API_URL === 'string' ? env.EXPO_PUBLIC_API_URL.trim() : '';
  const envUrl = envUrlRaw || null;
  const forceRemote = String(env?.EXPO_PUBLIC_FORCE_REMOTE_API || '').toLowerCase() === 'true';
  const preferLocalFallback = String(env?.EXPO_PUBLIC_USE_LOCAL_API || '').toLowerCase() === 'true';
  const useLocalDefault = __DEV__ && !forceRemote && !envUrl && preferLocalFallback;

  let primary = envUrl || (useLocalDefault ? DEFAULT_LOCAL_API_URL : DEFAULT_REMOTE_API_URL);
  if (__DEV__ && primary.startsWith('http://localhost') && Platform.OS === 'android') {
    primary = primary.replace('http://localhost', 'http://10.0.2.2');
  }
  const sanitizedPrimary = sanitizeUrl(primary);

  let fallback: string | null = null;
  if (!forceRemote) {
    const localBase = sanitizeUrl(
      __DEV__ && Platform.OS === 'android'
        ? DEFAULT_LOCAL_API_URL.replace('http://localhost', 'http://10.0.2.2')
        : DEFAULT_LOCAL_API_URL
    );
    if (envUrl) {
      // If an explicit API URL is provided but we prefer local in dev, use local as fallback.
      fallback = preferLocalFallback ? localBase : DEFAULT_REMOTE_API_URL;
    } else if (useLocalDefault) {
      // When using local as primary by default, remote is a good fallback.
      fallback = DEFAULT_REMOTE_API_URL;
    }
  }

  const sanitizedFallback = fallback ? sanitizeUrl(fallback) : null;

  return {
    current: sanitizedPrimary,
    fallback: sanitizedFallback,
    envUrl,
    forceRemote,
    preferLocalFallback,
    usedLocalDefault: useLocalDefault,
  };
}

function logBase(event: 'init' | 'fallback', state: ApiBaseState) {
  if (!__DEV__) return;
  const meta = {
    envUrl: state.envUrl,
    fallbackAvailable: !!state.fallback,
    event,
    forceRemote: state.forceRemote,
    preferLocalFallback: state.preferLocalFallback,
    platform: Platform.OS,
  };
  // eslint-disable-next-line no-console
  console.log('[http] API base:', state.current, meta);
}

function getApiBaseState(): ApiBaseState {
  if (!apiBaseState) {
    apiBaseState = resolveApiBaseState();
    logBase('init', apiBaseState);
  }
  return apiBaseState;
}

export function getApiBaseUrl(): string {
  return getApiBaseState().current;
}

function getBaseUrl(): string {
  return getApiBaseUrl();
}

function maybeSwitchToFallback(): boolean {
  const state = getApiBaseState();
  if (!state.fallback || state.current === state.fallback) {
    return false;
  }
  state.current = state.fallback;
  state.fallback = null;
  logBase('fallback', state);
  return true;
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

  const perform = async (resolvedBase: string, allowRefresh: boolean = true): Promise<any> => {
    const targetUrl = resolvedBase + path;
    try {
      // HTTP request initiated
      const res = await fetch(targetUrl, {
        ...options,
        headers,
        signal: controller.signal,
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

        // In development, allow automatic fallback on server-side errors (5xx)
        if (__DEV__ && res.status >= 500) {
          if (maybeSwitchToFallback()) {
            return perform(getBaseUrl(), allowRefresh);
          }
        }
        // Handle 401 Unauthorized - try one-time refresh, then retry
        if (res.status === 401 && allowRefresh && refreshHandler) {
          try {
            const ok = await refreshHandler();
            if (ok) {
              // Rebuild Authorization header with the new token and retry once
              const newToken = getAuthToken();
              if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
              return await perform(resolvedBase, false);
            }
          } catch {}
        }
        // If we reach here, either refresh isn't available, or it failed
        if (res.status === 401) {
          clearAuthToken();
        }
        throw err;
      }
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.warn('[http] Request failed:', { url: targetUrl, error: error.message });
      if (error.name === 'AbortError') {
        const timeoutError: any = new Error(`Request to ${resolvedBase}${path} timed out after ${timeoutMs}ms`);
        timeoutError.status = 0;
        timeoutError.originalError = error;
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      // Add more context to network errors
      if (error.message === 'Network request failed') {
        const err: any = new Error(`Cannot connect to server at ${resolvedBase}. Make sure the backend is running or reachable.`);
        err.originalError = error;
        err.status = 0;
        throw err;
      }
      throw error;
    }
  };

  try {
    return await perform(base, true);
  } catch (error: any) {
    if (error?.status === 0 && maybeSwitchToFallback()) {
      return perform(getBaseUrl(), true);
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
