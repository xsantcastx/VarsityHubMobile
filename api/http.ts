import { captureBreadcrumb, captureException } from '@/utils/sentry';
import Constants from 'expo-constants';

let tokenCache: string | null = null;
export function setAuthToken(token: string | null) { tokenCache = token || null; }
export function clearAuthToken() { tokenCache = null; }
export function getAuthToken(): string | null { return tokenCache; }

// Refresh lock: prevents concurrent refresh attempts when multiple 401s fire simultaneously
let refreshPromise: Promise<string | null> | null = null;

export function getApiBaseUrl(): string {
  // Support environment-based configuration for testing/staging/preview builds
  const PRODUCTION_URL = 'https://api-production-8ac3.up.railway.app';
  const envUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl;
  const normalizedEnvUrl = envUrl?.trim().replace(/\/$/, '');
  const isLocalhost = normalizedEnvUrl ? /(^http:\/\/localhost)|(^http:\/\/127\.0\.0\.1)/.test(normalizedEnvUrl) : false;
  const finalUrl = normalizedEnvUrl && (!isLocalhost || __DEV__) ? normalizedEnvUrl : PRODUCTION_URL;
  const isCustom = finalUrl !== PRODUCTION_URL;

  if (__DEV__ && !('__VH_LOGGED_API_BASE' in (globalThis as any))) {
    (globalThis as any).__VH_LOGGED_API_BASE = true;
    if (__DEV__) console.log('[http] API base:', finalUrl, isCustom ? '(custom)' : '(production)');
  }
  
  return finalUrl;
}

function getBaseUrl(): string {
  return getApiBaseUrl();
}

async function request(path: string, options: RequestInit = {}, timeoutMs: number = 30000, retries: number = 1): Promise<any> {
  const base = getBaseUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Avoid stale caches/Etags for personalized endpoints
  if (/^\/(me|auth\/me|rsvps|follows|support|search|users|teams|team-memberships|team-invites|events\/)/.test(path)) {
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
      } catch (error) {
        data = null;
      }
    } else {
      data = text; // plain text or HTML
    }

    if (!res.ok) {
      // Detect Bad Gateway HTML responses (Railway error pages with Correlation Key)
      // Railway correlation keys are 27 uppercase alphanumeric characters
      // Pattern: "Correlation Key: [27 alphanumeric chars]" (case-insensitive, flexible whitespace)
      const hasCorrelationKey = typeof data === 'string' && 
        (/Correlation Key:?\s*[A-Z0-9]{27}/i.test(data) || 
         /[A-Z0-9]{27}/.test(data)); // Also match standalone 27-char keys
      const isRailwayErrorPage = res.status === 502 && 
        (ct.includes('text/html') || 
         (typeof data === 'string' && (
           data.includes('Bad Gateway') || 
           data.includes('502') ||
           data.includes('Correlation Key') ||
           hasCorrelationKey ||
           /[A-Z0-9]{27}/.test(data) // Match any 27-char alphanumeric (likely correlation key)
         )));
      
      const isHtmlError = ct.includes('text/html') && typeof data === 'string';
      const msg = ct.includes('application/json') 
        ? (data && (data.error || data.message)) 
        : isRailwayErrorPage 
          ? 'Server temporarily unavailable' 
          : isHtmlError
            ? (res.status === 404 ? 'Endpoint not found. Please update the app.' : `Request failed (${res.status}). Please try again.`)
            : (typeof data === 'string' ? data : null);
      
      const err: any = new Error(msg || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      err.isRailwayErrorPage = isRailwayErrorPage; // Flag for retry logic
      
      // On 401, attempt a token refresh before giving up.
      // Do not clear on 403 (forbidden) because role-based endpoints can return 403 for valid sessions.
      if (err.status === 401 && token) {
        // Lazy-import to avoid circular dependency (auth.ts imports from http.ts)
        const { auth } = await import('./auth');

        // Coalesce concurrent refresh attempts behind a single promise
        if (!refreshPromise) {
          refreshPromise = auth.refreshToken().finally(() => { refreshPromise = null; });
        }
        const newToken = await refreshPromise;

        if (newToken) {
          // Retry the original request with the fresh token
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryRes = await fetch(base + path, { ...options, headers, signal: undefined });
          if (retryRes.ok) {
            const retryText = await retryRes.text();
            const retryCt = (retryRes.headers && retryRes.headers.get && retryRes.headers.get('content-type')) || '';
            if (retryCt.includes('application/json')) {
              try { return retryText ? JSON.parse(retryText) : null; } catch { return null; }
            }
            return retryText;
          }
          // Retry also failed — parse actual retry response and throw its error
          const retryText = await retryRes.text().catch(() => '');
          const retryCt = (retryRes.headers && retryRes.headers.get && retryRes.headers.get('content-type')) || '';
          let retryData: any = null;
          if (retryCt.includes('application/json')) {
            try { retryData = retryText ? JSON.parse(retryText) : null; } catch { retryData = null; }
          } else {
            retryData = retryText || null;
          }
          const retryMsg = retryCt.includes('application/json')
            ? (retryData && (retryData.error || retryData.message))
            : (retryRes.status === 401 ? 'Session expired' : null);
          const retryErr: any = new Error(retryMsg || `HTTP ${retryRes.status}`);
          retryErr.status = retryRes.status;
          retryErr.data = retryData;
          // Only clear auth token if the retry itself returned 401 (session truly expired)
          if (retryRes.status === 401) {
            clearAuthToken();
          }
          throw retryErr;
        }

        // Refresh failed or no refresh token — clear and throw
        clearAuthToken();
      }
      throw err;
    }
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Suppress verbose logging for expected auth errors in dev mode
    const isAuthError = path.includes('/auth/') || path.includes('/me');
    const isAbortError = error.name === 'AbortError';
    const isExpectedDevError = __DEV__ && isAuthError && (error.status === 401 || error.status === 408 || error.status === 400);
    const isExpectedAbortInDev = __DEV__ && isAbortError;
    
    // Suppress logging for known missing endpoints
    const isKnownMissingEndpoint =
      path.includes('/geocoding/autocomplete') ||
      path.includes('/posts/trending') ||
      (path.includes('/users') && error.status === 403) ||
      // Public user profile lookups that return 404 are expected (user deleted/not found)
      (/^\/users\/[^/]+$/.test(path) && error.status === 404) ||
      (path.includes('/notifications') && error.status === 401);
    
    // Enhanced error logging with more context
    if (!isExpectedDevError && !isKnownMissingEndpoint && !isExpectedAbortInDev) {
      const errorDetails = {
        url: base + path,
        method: options.method || 'GET',
        status: error.status,
        message: error.message,
        name: error.name,
        ...(error.data && { responseData: error.data }),
      };
      if (__DEV__) console.error('[http] Request failed:', errorDetails);
      
      // Capture non-network errors to Sentry (network errors already handled below)
      if (error.status && error.status >= 500) {
        captureException(error, { 
          tags: { component: 'http-client', endpoint: path },
          extra: errorDetails 
        });
      }
    }
    if (isExpectedAbortInDev) {
      console.debug(`[http] Request timed out: ${path}`);
    }
    
    // Handle 502 Bad Gateway errors with retry - backend may be temporarily down
    // Railway infrastructure errors show HTML error pages with Correlation Keys
    // Since ALL our API calls go to Railway, ANY 502 error is a Railway infrastructure issue
    if (error.status === 502 || error.isRailwayErrorPage) {
      // Improved Railway error detection - check for correlation key pattern (27 uppercase alphanumeric)
      // More flexible pattern matching to catch all Railway error formats
      const hasCorrelationKey = typeof error.data === 'string' && 
        (/Correlation Key:?\s*[A-Z0-9]{27}/i.test(error.data) ||
         /[A-Z0-9]{27}/.test(error.data)); // Match standalone 27-char keys
      
      // ALL 502 errors from our Railway backend should be treated as infrastructure errors
      // This ensures maximum retries and proper handling
      const isRailwayInfraError = error.status === 502 || error.isRailwayErrorPage || hasCorrelationKey;
      
      if (__DEV__) console.error('[http] 502 Bad Gateway on', path, '- Railway infra error:', isRailwayInfraError, '- retries left:', retries);
      captureException(error, { 
        tags: { 
          component: 'http-client', 
          endpoint: path, 
          errorType: 'bad-gateway',
          railwayInfraError: String(isRailwayInfraError)
        },
        extra: { path, method: options.method || 'GET', base, retries, isRailwayErrorPage: error.isRailwayErrorPage, hasCorrelationKey } 
      });
      
      // Aggressive retry for 502 errors - Railway infrastructure can be temporarily unstable
      // For critical endpoints (payments, auth), allow more retries
      // For Railway infrastructure errors, be even more aggressive
      const isCriticalEndpoint = path.includes('/payments/') || path.includes('/auth/') || path.includes('/me') || path.includes('/notifications');
      const maxRetriesFor502 = isRailwayInfraError 
        ? (isCriticalEndpoint ? 5 : 4) // More retries for Railway infra errors
        : (isCriticalEndpoint ? 3 : 2); // Standard retries for app-level 502
      const effectiveRetries = Math.min(retries, maxRetriesFor502);
      
      if (effectiveRetries > 0) {
        // Longer delays for Railway infrastructure errors (they need more time to recover)
        const baseDelay = isRailwayInfraError ? 1000 : 500;
        const retryCount = maxRetriesFor502 - effectiveRetries;
        const delay = Math.min(3000, baseDelay * Math.pow(2, retryCount)); // Exponential backoff
        
        if (__DEV__) console.log(`[http] Retrying 502 Bad Gateway after ${delay}ms... (${effectiveRetries}/${maxRetriesFor502} retries left)`);
        await new Promise(r => setTimeout(r, delay));
        // Retry with original retries count but ensure we don't exceed maxRetriesFor502
        return request(path, options, timeoutMs, Math.min(retries - 1, maxRetriesFor502 - 1));
      }
      
// If all retries exhausted, provide user-friendly error
      const err: any = new Error(
        isRailwayInfraError 
          ? 'Our servers are temporarily unavailable. Please try again in a few moments.'
          : 'Server temporarily unavailable. Please try again in a moment.'
      );
      err.status = 502;
      err.data = error.data;
      err.isRailwayErrorPage = error.isRailwayErrorPage;
      throw err;
    }
    
    // Handle 429 Rate Limit errors — never retry, throw immediately.
    // Retrying would just extend the wait and make things worse (retryAfter can be 900s+).
    if (error.status === 429) {
      const retryAfter = typeof error.data?.retryAfter === 'number' ? error.data.retryAfter : null;
      const msg = retryAfter && retryAfter > 0 && retryAfter <= 300
        ? `Too many attempts. Please try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`
        : 'Too many attempts. Please wait a moment and try again.';
      const err: any = new Error(msg);
      err.status = 429;
      err.data = error.data;
      err.retryAfter = retryAfter;
      throw err;
    }
    
    if (error.name === 'AbortError') {
      const err: any = new Error('Request timeout - server did not respond');
      err.status = 408;
      if (!isExpectedDevError && !__DEV__) {
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
      // Always show production server error (we never use localhost)
      const errorMessage = `Cannot connect to server at ${base}. Please check your internet connection and try again.`;
      
      const err: any = new Error(errorMessage);
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

export function httpGet(path: string, options: RequestInit = {}, timeoutMs?: number, retriesOverride?: number) {
  // Allow more retries for critical endpoints (helps with Railway infrastructure errors)
  // Critical endpoints get additional retries automatically in 502 handler
  const isCriticalEndpoint = path.includes('/payments/') || path.includes('/auth/') || path.includes('/me') || path.includes('/notifications');
  const defaultRetries = isCriticalEndpoint ? 5 : 3; // More retries for critical endpoints
  const retries = typeof retriesOverride === 'number' ? Math.max(0, retriesOverride) : defaultRetries;
  return request(path, { ...options, method: 'GET' }, timeoutMs || 30000, retries);
}
// Default POST should never retry automatically (prevents duplicate mutations).
export function httpPost(path: string, body?: any) { 
  return request(path, { method: 'POST', body: JSON.stringify(body || {}) }, 15000, 0); 
}
// POST with explicit timeout/retry controls for endpoint-specific tuning.
export function httpPostWithOptions(path: string, body: any, timeoutMs: number, retries: number = 0) {
  return request(path, { method: 'POST', body: JSON.stringify(body || {}) }, timeoutMs, Math.max(0, retries));
}
// Long-timeout POST for heavy endpoints, still no automatic retries for safety.
export function httpPostLongTimeout(path: string, body?: any) {
  return request(path, { method: 'POST', body: JSON.stringify(body || {}) }, 180000, 0); // 3 minute timeout
}
// PUT/PATCH/DELETE should NOT retry - they are state-changing operations
// Retrying could cause duplicate updates or delete operations on already-deleted resources
export function httpPut(path: string, body?: any) { return request(path, { method: 'PUT', body: JSON.stringify(body || {}) }, 15000, 0); }
export function httpPatch(path: string, body?: any) { return request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }, 15000, 0); }
export function httpDelete(path: string, body?: any) {
  const payload = typeof body === 'undefined' ? undefined : JSON.stringify(body);
  const options: RequestInit = payload ? { method: 'DELETE', body: payload } : { method: 'DELETE' };
  return request(path, options, 15000, 0);
}
