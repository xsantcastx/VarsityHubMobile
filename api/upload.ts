import auth from './auth';
import { getApiBaseUrl } from './http';

function computeBase(provided?: string | null) {
  if (provided) return provided.replace(/\/$/, '');
  return getApiBaseUrl();
}

export interface UploadProgressCallback {
  (progress: number, loaded: number, total: number): void;
}

export interface UploadOptions {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  onProgress?: UploadProgressCallback;
}

async function resolveUploadToken(): Promise<string | null> {
  const fromSession = await auth.getToken();
  if (fromSession) return fromSession;
  try {
    const refreshed = await auth.getToken();
    return refreshed || null;
  } catch {
    return null;
  }
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

// -----------------------------------------------
// Direct-to-Cloudinary upload (skips your server)
// Phone → Cloudinary CDN. ~2x faster than proxying through Railway.
// -----------------------------------------------

// Cache signature for 55s (signatures valid ~60min, but re-fetch well before expiry)
let _sigCache: { sig: { cloudName: string; apiKey: string; signature: string; timestamp: number; folder: string }; fetchedAt: number } | null = null;
const SIG_CACHE_TTL_MS = 55_000;

async function getCloudinarySignature(baseUrl: string): Promise<{
  cloudName: string; apiKey: string; signature: string; timestamp: number; folder: string;
} | null> {
  // Return cached signature if still fresh
  if (_sigCache && Date.now() - _sigCache.fetchedAt < SIG_CACHE_TTL_MS) {
    if (__DEV__) console.log('[upload] Using cached Cloudinary signature');
    return _sigCache.sig;
  }

  const token = await resolveUploadToken();
  if (!token) return null;
  try {
    const res = await fetch(`${baseUrl}/uploads/cloudinary-signature`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const sig = await res.json() as any;
    _sigCache = { sig, fetchedAt: Date.now() };
    return sig;
  } catch {
    return null;
  }
}

async function uploadDirectToCloudinary(
  uri: string,
  filename: string,
  mimeType: string,
  sig: { cloudName: string; apiKey: string; signature: string; timestamp: number; folder: string },
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
          resolve({
            url: data.secure_url || data.url,
            type: resourceType,
            mime: mimeType,
          });
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
export async function uploadFile(
  baseUrl: string | null | undefined,
  uri: string,
  filename?: string,
  mimeType?: string,
  options?: UploadOptions,
): Promise<any> {
  const finalBase = computeBase(baseUrl);
  const finalMimeType = detectMime(mimeType, filename, uri);
  const finalFilename = filename || 'upload';

  // Try direct-to-Cloudinary first (faster — skips server proxy)
  try {
    const sig = await getCloudinarySignature(finalBase);
    if (sig) {
      if (__DEV__) console.log('[upload] Using direct Cloudinary upload');
      return await uploadDirectToCloudinary(uri, finalFilename, finalMimeType, sig, options);
    }
  } catch (directErr: any) {
    if (__DEV__) console.warn('[upload] Direct upload failed, falling back to server proxy:', directErr?.message);
  }

  // Fallback: proxy through server (works when Cloudinary signature endpoint unavailable)
  if (__DEV__) console.log('[upload] Using server-proxy upload');
  return uploadViaServer(finalBase, uri, finalFilename, finalMimeType, options);
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
  const finalMimeType = detectMime(mimeType, filename, uri);
  const finalFilename = filename || 'upload';

  // Try direct-to-Cloudinary (has XHR progress built in)
  try {
    const sig = await getCloudinarySignature(finalBase);
    if (sig) {
      if (__DEV__) console.log('[upload] Using direct Cloudinary upload (with progress)');
      return await uploadDirectToCloudinary(uri, finalFilename, finalMimeType, sig, options);
    }
  } catch (directErr: any) {
    if (__DEV__) console.warn('[upload] Direct upload failed, falling back to server proxy:', directErr?.message);
  }

  // Fallback: XHR to server
  const target = `${finalBase}/uploads`;
  const token = await resolveUploadToken();
  if (!token) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const isVideo = finalMimeType.startsWith('video/');
  const timeoutMs = options?.timeoutMs ?? (isVideo ? 300000 : 180000);
  const onProgress = options?.onProgress;

  const form = new FormData();
  form.append('file', { uri, name: finalFilename, type: finalMimeType } as any);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total);
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Non-JSON response')); }
      } else {
        const err: any = new Error(`Upload failed: HTTP ${xhr.status}`);
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout = timeoutMs;
    xhr.open('POST', target);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form as any);
  });
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
  const target = `${base}/uploads`;

  const form = new FormData();
  form.append('file', { uri, name: filename, type: mimeType } as any);

  const headers: any = {};
  const token = await resolveUploadToken();
  if (!token) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  headers.Authorization = `Bearer ${token}`;

  const retries = Math.max(0, options?.retries ?? 2);
  const backoffMs = Math.max(50, options?.backoffMs ?? 500);
  const isVideo = mimeType.startsWith('video/');
  const timeoutMs = options?.timeoutMs ?? (isVideo ? 300000 : 120000);
  let attempt = 0;
  let lastErr: any = null;
  let refreshAttempted = false;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (__DEV__) console.log('[upload] Server proxy attempt', attempt + 1, '/', retries + 1, '| file:', filename);
      const res = await fetch(target, {
        method: 'POST',
        headers,
        body: form as any,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      if (!text) throw new Error(`Empty response (HTTP ${res.status})`);
      let data;
      try { data = JSON.parse(text); } catch {
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
      const isAbort = err.name === 'AbortError';
      const isNetwork = err instanceof TypeError && err.message === 'Network request failed';
      const isTimeout = isAbort || /timeout|timed out/i.test(String(err?.message || ''));
      if (err?.status === 401 && !refreshAttempted) {
        refreshAttempted = true;
        const refreshed = await auth.getToken();
        if (refreshed) { headers.Authorization = `Bearer ${refreshed}`; continue; }
      }
      if (attempt < retries && (isNetwork || isTimeout)) {
        await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
        attempt++;
        continue;
      }
      break;
    }
  }

  if (lastErr?.name === 'AbortError') throw new Error('Upload timed out. Please check your connection and try again.');
  if (lastErr instanceof TypeError && lastErr.message === 'Network request failed') {
    throw new Error('Network error: unable to reach upload endpoint.');
  }
  if (lastErr?.status === 401) { const err: any = new Error('Unauthorized'); err.status = 401; throw err; }
  throw lastErr;
}

export default { uploadFile, uploadFileWithProgress };
