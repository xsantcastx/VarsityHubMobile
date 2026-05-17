import { compressImageForUpload } from '@/utils/ensureUploadableUri';
import { isEmailVerificationRequiredError, openVerificationGate } from '@/hooks/useVerificationGate';
import { emitSessionExpired } from '@/utils/sessionEvents';
import auth from './auth';
import {
  getAccessTokenForRequest,
  getApiBaseUrl,
  refreshAccessTokenWithCache,
  type RefreshOutcome,
} from './http';

function computeBase(provided?: string | null) {
  if (provided) return provided.replace(/\/$/, '');
  return getApiBaseUrl();
}

function buildUploadUrl(
  target: string,
  formFields?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!formFields) return target;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(formFields)) {
    if (value == null) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${target}?${query}` : target;
}

export interface UploadProgressCallback {
  (progress: number, loaded: number, total: number): void;
}

export interface UploadOptions {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  onProgress?: UploadProgressCallback;
  formFields?: Record<string, string | number | boolean | null | undefined>;
}

interface UploadFetchConfig {
  target: string;
  uri: string;
  filename: string;
  mimeType: string;
  options?: UploadOptions;
  timeoutMs: number;
  debugLabel?: string;
  coerceFinal401ToUnauthorized?: boolean;
}

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
};

function detectMime(mimeType?: string, filename?: string, uri?: string): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  const name = filename || uri || '';
  const ext = name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|avi|mkv)$/)?.[1];
  return (ext && MIME_MAP[ext]) || 'image/jpeg';
}

function buildUploadFormData(
  uri: string,
  filename: string,
  mimeType: string,
  formFields?: Record<string, string | number | boolean | null | undefined>,
): FormData {
  const form = new FormData();
  form.append('file', { uri, name: filename, type: mimeType } as any);
  for (const [key, value] of Object.entries(formFields || {})) {
    if (value == null) continue;
    form.append(key, String(value));
  }
  return form;
}

function buildUploadNetworkError(error: any, coerceFinal401ToUnauthorized = false): Error {
  if (error?.name === 'AbortError') {
    return new Error('Upload timed out. Please check your connection and try again.');
  }
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return new Error('Network error: unable to reach upload endpoint.');
  }
  if (coerceFinal401ToUnauthorized && error?.status === 401) {
    const unauthorized: any = new Error('Unauthorized');
    unauthorized.status = 401;
    if (error?.isSessionExpired === true) unauthorized.isSessionExpired = true;
    if (error?.isTransientAuthError === true) unauthorized.isTransientAuthError = true;
    return unauthorized;
  }
  return error;
}

async function resolveUploadHeaders(): Promise<Record<string, string>> {
  const token = await getAccessTokenForRequest({ allowRefresh: true });
  if (!token) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return { Authorization: `Bearer ${token}` };
}

function buildTransientUploadAuthError(refreshResult: RefreshOutcome): Error {
  const transientAuthErr: any = new Error(
    'Unable to refresh session right now. Please try again.'
  );
  transientAuthErr.status = 503;
  transientAuthErr.isTransientAuthError = true;
  transientAuthErr.refreshFailureReason = refreshResult.reason;
  transientAuthErr.originalError =
    refreshResult && 'error' in refreshResult ? refreshResult.error : undefined;
  return transientAuthErr;
}

async function applyRefreshResultToUploadBoundary(
  refreshResult: RefreshOutcome,
  headers: Record<string, string>,
  error?: any
): Promise<boolean> {
  if (refreshResult?.accessToken) {
    headers.Authorization = `Bearer ${refreshResult.accessToken}`;
    return true;
  }

  if (refreshResult?.reason === 'auth' || refreshResult?.reason === 'missing') {
    await auth.clearTokensOnly();
    if (error) error.isSessionExpired = true;
    emitSessionExpired(
      refreshResult.reason === 'missing' ? 'refresh_missing' : 'refresh_failed'
    );
    return false;
  }

  throw buildTransientUploadAuthError(refreshResult);
}

async function handleUploadAccessBoundary(
  error: any,
  headers: Record<string, string>,
  verificationPromptedRef: { current: boolean },
  refreshAttemptedRef: { current: boolean },
): Promise<boolean> {
  if (error?.status === 401 && !refreshAttemptedRef.current) {
    refreshAttemptedRef.current = true;
    const refreshed = await refreshAccessTokenWithCache();
    return applyRefreshResultToUploadBoundary(refreshed, headers, error);
  }

  if (
    isEmailVerificationRequiredError(error?.status, error?.data) &&
    !verificationPromptedRef.current
  ) {
    verificationPromptedRef.current = true;
    const verified = await openVerificationGate();
    if (verified) {
      const refreshedToken = await getAccessTokenForRequest({ allowRefresh: true });
      if (refreshedToken) {
        headers.Authorization = `Bearer ${refreshedToken}`;
        return true;
      }
    }
  }

  return false;
}

async function uploadViaFetchWithRetries({
  target,
  uri,
  filename,
  mimeType,
  options,
  timeoutMs,
  debugLabel,
  coerceFinal401ToUnauthorized = false,
}: UploadFetchConfig): Promise<any> {
  const form = buildUploadFormData(uri, filename, mimeType, options?.formFields);
  const headers = await resolveUploadHeaders();
  const retries = Math.max(0, options?.retries ?? 2);
  const backoffMs = Math.max(50, options?.backoffMs ?? 500);
  const refreshAttemptedRef = { current: false };
  const verificationPromptedRef = { current: false };
  let attempt = 0;
  let lastErr: any = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (__DEV__ && debugLabel) {
        console.log('[upload]', debugLabel, attempt + 1, '/', retries + 1, '| file:', filename);
      }
      const res = await fetch(target, {
        method: 'POST',
        headers,
        body: form as any,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      if (!text) throw new Error(`Empty response (HTTP ${res.status})`);
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.substring(0, 100)}`);
      }
      if (!res.ok) {
        const err: any = new Error((data?.error || data?.message) || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastErr = err;

      if (
        await handleUploadAccessBoundary(
          err,
          headers,
          verificationPromptedRef,
          refreshAttemptedRef,
        )
      ) {
        continue;
      }

      const isNetwork = err instanceof TypeError && err.message === 'Network request failed';
      const isTimeout = err?.name === 'AbortError' || /timeout|timed out/i.test(String(err?.message || ''));
      if (attempt < retries && (isNetwork || isTimeout)) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
        attempt++;
        continue;
      }
      break;
    }
  }

  throw buildUploadNetworkError(lastErr, coerceFinal401ToUnauthorized);
}

// -----------------------------------------------
// Direct-to-Cloudinary upload (skips your server)
// Phone → Cloudinary CDN. ~2x faster than proxying through Railway.
// -----------------------------------------------

// Cache signature for 55s (signatures valid ~60min, but re-fetch well before expiry)
let _sigCache: { sig: { cloudName: string; apiKey: string; signature: string; timestamp: number; folder: string }; fetchedAt: number } | null = null;
const SIG_CACHE_TTL_MS = 55_000;

async function getCloudinarySignature(
  baseUrl: string,
  options?: UploadOptions,
): Promise<{
  cloudName: string;
  apiKey: string;
  signature: string;
  timestamp: number;
  folder: string;
  // v1.0.3: the server signs these constraints into the signature so the
  // client can't weaken them. The client MUST send them back unchanged in
  // the upload form, otherwise Cloudinary computes the signature over a
  // different param set and rejects with "Invalid Signature".
  allowed_formats?: string;
  max_bytes?: string;
} | null> {
  // Return cached signature if still fresh
  if (_sigCache && Date.now() - _sigCache.fetchedAt < SIG_CACHE_TTL_MS) {
    if (__DEV__) console.log('[upload] Using cached Cloudinary signature');
    return _sigCache.sig;
  }

  let token = await getAccessTokenForRequest({ allowRefresh: true });
  if (!token) return null;

  let refreshAttempted = false;
  let verificationPrompted = false;

  while (token) {
    try {
      const res = await fetch(buildUploadUrl(`${baseUrl}/uploads/cloudinary-signature`, options?.formFields), {
        headers: { Authorization: `Bearer ${token}` },
      });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 401 && !refreshAttempted) {
            refreshAttempted = true;
            const refreshed = await refreshAccessTokenWithCache();
            token = refreshed?.accessToken ?? null;
            if (token) continue;
            if (refreshed.reason === 'auth' || refreshed.reason === 'missing') {
              await auth.clearTokensOnly();
              emitSessionExpired(
                refreshed.reason === 'missing' ? 'refresh_missing' : 'refresh_failed'
              );
              return null;
            }
            throw buildTransientUploadAuthError(refreshed);
          }
        if (
          isEmailVerificationRequiredError(res.status, data) &&
          !verificationPrompted
        ) {
          verificationPrompted = true;
          const verified = await openVerificationGate();
          if (verified) {
            token = await getAccessTokenForRequest({ allowRefresh: true });
            if (token) continue;
          }
        }
        if (__DEV__) console.warn('[upload] Cloudinary signature failed:', res.status, data || res.statusText);
        return null;
      }
      const sig = data as any;
      _sigCache = { sig, fetchedAt: Date.now() };
      return sig;
    } catch {
      return null;
    }
  }

  return null;
}

async function uploadDirectToCloudinary(
  uri: string,
  filename: string,
  mimeType: string,
  sig: {
    cloudName: string;
    apiKey: string;
    signature: string;
    timestamp: number;
    folder: string;
    allowed_formats?: string;
    max_bytes?: string;
  },
  options?: UploadOptions,
): Promise<{ url: string; type: string; mime: string }> {
  const isVideo = mimeType.startsWith('video/');
  const resourceType = isVideo ? 'video' : 'image';
  const timeoutMs = options?.timeoutMs ?? (isVideo ? 300000 : 120000);

  const form = new FormData();
  form.append('file', { uri, name: filename, type: mimeType } as any);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);
  // v1.0.3: mirror every SIGNED param back in the form. The server signed these
  // constraints into the signature; sending the form without them causes
  // Cloudinary to compute a different hash and reject with "Invalid Signature"
  // — the Sentry error that was surfacing to users as "Sign-in Required" in
  // production. Order doesn't matter for transport; Cloudinary sorts keys
  // before verifying.
  if (sig.allowed_formats) form.append('allowed_formats', sig.allowed_formats);
  if (sig.max_bytes) form.append('max_bytes', sig.max_bytes);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options?.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress!(Math.round((event.loaded / event.total) * 100), event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const url = data.secure_url || data.url;
          if (!url) {
            reject(new Error('Cloudinary returned no URL'));
            return;
          }
          resolve({ url, type: resourceType, mime: mimeType });
        } catch {
          reject(new Error('Cloudinary returned invalid response'));
        }
      } else {
        reject(new Error(`Cloudinary upload failed: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during direct upload'));
    xhr.ontimeout = () => reject(new Error('Direct upload timed out'));
    xhr.timeout = timeoutMs;
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`);
    xhr.send(form as any);
  });
}

// -----------------------------------------------
// Main upload function — tries direct Cloudinary, falls back to server proxy
// -----------------------------------------------
//
// Routing rules:
//   image/*, video/*  →  direct-to-Cloudinary (fast CDN path), then fall back to
//                        POST /uploads which is also image/video-only on the server.
//   everything else   →  POST /uploads/files (general multer endpoint that accepts
//                        PDFs and other document types). The Cloudinary signature
//                        endpoint is not configured for resource_type=raw, and the
//                        POST /uploads endpoint validates magic bytes against image
//                        or video MIME types — sending a PDF there was the root cause
//                        of the silent supporting-document upload failure during
//                        coach onboarding. Route PDFs (and any non-media) to
//                        /uploads/files so multer stores them without media-only
//                        validation.
export async function uploadFile(
  baseUrl: string | null | undefined,
  uri: string,
  filename?: string,
  mimeType?: string,
  options?: UploadOptions,
): Promise<any> {
  const finalBase = computeBase(baseUrl);
  let finalMimeType = detectMime(mimeType, filename, uri);
  const finalFilename = filename || 'upload';
  let finalUri = uri;

  const isMedia =
    finalMimeType.startsWith('image/') || finalMimeType.startsWith('video/');

  // Non-media files (PDFs, docs) go straight to the general-file server endpoint.
  // Don't try Cloudinary direct — the signature flow assumes resource_type=image|video.
  if (!isMedia) {
    if (__DEV__) console.log('[upload] Non-media upload via /uploads/files:', finalMimeType);
    return uploadRawViaServer(finalBase, finalUri, finalFilename, finalMimeType, options);
  }

  // Compress images before upload (max 1920px, 80% quality). Videos pass through unchanged.
  if (finalMimeType.startsWith('image/')) {
    try {
      const compressed = await compressImageForUpload(finalUri, finalMimeType);
      finalUri = compressed.uri;
      if (compressed.mimeType) finalMimeType = compressed.mimeType;
    } catch (e) {
      if (__DEV__) console.warn('[upload] Image compression failed, uploading original:', e);
    }
  }

  // Try direct-to-Cloudinary first (faster — skips server proxy)
  try {
    const sig = await getCloudinarySignature(finalBase, options);
    if (sig) {
      if (__DEV__) console.log('[upload] Using direct Cloudinary upload');
      return await uploadDirectToCloudinary(finalUri, finalFilename, finalMimeType, sig, options);
    }
  } catch (directErr: any) {
    if (__DEV__) {
      console.warn('[upload] Direct upload failed, falling back to server proxy:', directErr?.message);
      if (directErr?.status) console.warn('[upload] Error status:', directErr.status);
      if (directErr?.response) console.warn('[upload] Response:', directErr.response);
    }
  }

  // Fallback: proxy through server (works when Cloudinary signature endpoint unavailable)
  if (__DEV__) console.log('[upload] Using server-proxy upload');
  return uploadViaServer(finalBase, finalUri, finalFilename, finalMimeType, options);
}

// -----------------------------------------------
// Raw/document upload — POST /uploads/files (not /uploads).
// The /uploads endpoint is image/video only and magic-byte-validates against those;
// /uploads/files accepts general files including PDFs.
// -----------------------------------------------
async function uploadRawViaServer(
  base: string,
  uri: string,
  filename: string,
  mimeType: string,
  options?: UploadOptions,
): Promise<any> {
  const target = buildUploadUrl(`${base}/uploads/files`, options?.formFields);
  const timeoutMs = options?.timeoutMs ?? 180000;
  return uploadViaFetchWithRetries({
    target,
    uri,
    filename,
    mimeType,
    options,
    timeoutMs,
  });
}

// -----------------------------------------------
// XHR upload with progress (always uses server proxy)
// -----------------------------------------------
export async function uploadFileWithProgress(
  baseUrl: string | null | undefined,
  uri: string,
  filename?: string,
  mimeType?: string,
  options?: UploadOptions,
): Promise<any> {
  const finalBase = computeBase(baseUrl);
  let finalMimeType = detectMime(mimeType, filename, uri);
  const finalFilename = filename || 'upload';
  let finalUri = uri;

  // Compress images before upload (max 1920px, 80% quality). Videos pass through unchanged.
  if (finalMimeType.startsWith('image/')) {
    try {
      const compressed = await compressImageForUpload(finalUri, finalMimeType);
      finalUri = compressed.uri;
      if (compressed.mimeType) finalMimeType = compressed.mimeType;
    } catch (e) {
      if (__DEV__) console.warn('[upload] Image compression failed, uploading original:', e);
    }
  }

  // Try direct-to-Cloudinary (has XHR progress built in)
  try {
    const sig = await getCloudinarySignature(finalBase, options);
    if (sig) {
      if (__DEV__) console.log('[upload] Using direct Cloudinary upload (with progress)');
      return await uploadDirectToCloudinary(finalUri, finalFilename, finalMimeType, sig, options);
    }
  } catch (directErr: any) {
    if (__DEV__) {
      console.warn('[upload] Direct upload failed (with progress), falling back to server proxy:', directErr?.message);
      if (directErr?.status) console.warn('[upload] Error status:', directErr.status);
    }
  }

  const target = buildUploadUrl(`${finalBase}/uploads`, options?.formFields);
  const token = await getAccessTokenForRequest({ allowRefresh: true });
  if (!token) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const isVideo = finalMimeType.startsWith('video/');
  const timeoutMs = options?.timeoutMs ?? (isVideo ? 300000 : 180000);
  const onProgress = options?.onProgress;

  const form = new FormData();
  form.append('file', { uri: finalUri, name: finalFilename, type: finalMimeType } as any);
  for (const [key, value] of Object.entries(options?.formFields || {})) {
    if (value == null) continue;
    form.append(key, String(value));
  }

  const attemptUpload = async (
    currentToken: string,
    refreshAttempted = false
  ): Promise<any> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total);
          }
        };
      }
      xhr.onload = () => {
        void (async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Non-JSON response'));
            }
            return;
          }

          if (xhr.status === 401 && !refreshAttempted) {
            try {
              const refreshed = await refreshAccessTokenWithCache();
              if (refreshed.accessToken) {
                resolve(await attemptUpload(refreshed.accessToken, true));
                return;
              }
              if (refreshed.reason === 'auth' || refreshed.reason === 'missing') {
                await auth.clearTokensOnly();
                const sessionErr: any = new Error('Unauthorized');
                sessionErr.status = 401;
                sessionErr.isSessionExpired = true;
                emitSessionExpired(
                  refreshed.reason === 'missing' ? 'refresh_missing' : 'refresh_failed'
                );
                reject(sessionErr);
                return;
              }
              reject(buildTransientUploadAuthError(refreshed));
              return;
            } catch (error) {
              reject(error);
              return;
            }
          }

          const err: any = new Error(`Upload failed: HTTP ${xhr.status}`);
          err.status = xhr.status;
          reject(err);
        })();
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timed out'));
      xhr.timeout = timeoutMs;
      xhr.open('POST', target);
      xhr.setRequestHeader('Authorization', `Bearer ${currentToken}`);
      xhr.send(form as any);
    });

  return attemptUpload(token);
}

// -----------------------------------------------
// Server-proxy upload (original path, kept as fallback)
// -----------------------------------------------
async function uploadViaServer(
  base: string,
  uri: string,
  filename: string,
  mimeType: string,
  options?: UploadOptions,
): Promise<any> {
  const target = buildUploadUrl(`${base}/uploads`, options?.formFields);
  const isVideo = mimeType.startsWith('video/');
  const timeoutMs = options?.timeoutMs ?? (isVideo ? 300000 : 120000);
  return uploadViaFetchWithRetries({
    target,
    uri,
    filename,
    mimeType,
    options,
    timeoutMs,
    debugLabel: 'Server proxy attempt',
    coerceFinal401ToUnauthorized: true,
  });
}

export default { uploadFile, uploadFileWithProgress };
