import { getApiBaseUrl, getAuthToken } from './http';

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

/**
 * Upload a file with progress tracking using XMLHttpRequest
 * Falls back to fetch if XHR fails
 */
export async function uploadFileWithProgress(
  baseUrl: string | null | undefined,
  uri: string,
  filename?: string,
  mimeType?: string,
  options?: UploadOptions
): Promise<any> {
  const finalBase = computeBase(baseUrl);
  const target = `${finalBase}/uploads`;
  const token = getAuthToken();
  const timeoutMs = options?.timeoutMs ?? 180000;
  const onProgress = options?.onProgress;

  // Improved mime type detection
  let finalMimeType = mimeType;
  if (!finalMimeType || finalMimeType === 'application/octet-stream') {
    const name = filename || uri;
    const ext = name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|avi|mkv)$/)?.[1];
    if (ext) {
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
        mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
      };
      finalMimeType = mimeMap[ext] || 'image/jpeg';
    } else {
      finalMimeType = 'image/jpeg';
    }
  }

  const form = new FormData();
  form.append('file', { uri, name: filename || 'upload', type: finalMimeType } as any);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Set up progress tracking
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress, event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new Error(`Server returned non-JSON response: ${xhr.responseText.substring(0, 100)}`));
        }
      } else {
        const err: any = new Error(`Upload failed: HTTP ${xhr.status}`);
        err.status = xhr.status;
        try { err.data = JSON.parse(xhr.responseText); } catch {}
        reject(err);
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out'));
    };

    xhr.timeout = timeoutMs;
    xhr.open('POST', target);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form as any);
  });
}

export async function uploadFile(baseUrl: string | null | undefined, uri: string, filename?: string, mimeType?: string, options?: UploadOptions): Promise<any> {
  const finalBase = computeBase(baseUrl);
  const target = `${finalBase}/uploads`;

  // Improved mime type detection
  let finalMimeType = mimeType;
  if (!finalMimeType || finalMimeType === 'application/octet-stream') {
    // Try to detect from filename
    const name = filename || uri;
    const ext = name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mkv)$/)?.[1];
    if (ext) {
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        mkv: 'video/x-matroska',
      };
      finalMimeType = mimeMap[ext] || 'image/jpeg'; // default to jpeg if image
    } else {
      // Default to image/jpeg for safety
      finalMimeType = 'image/jpeg';
    }
  }

  const form = new FormData();
  form.append('file', {
    uri,
    name: filename || 'upload',
    type: finalMimeType,
  } as any);

  const headers: any = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const retries = Math.max(0, options?.retries ?? 5); // 5 retries by default for reliability
  const backoffMs = Math.max(50, options?.backoffMs ?? 1000); // 1 second backoff
  const timeoutMs = options?.timeoutMs ?? 180000; // 3 minute default timeout for uploads
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= retries) {
    // Add timeout via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log('[upload] Uploading to:', target, '| attempt', attempt + 1, '/', retries + 1, '| file:', filename, '| mime:', finalMimeType);
      const res = await fetch(target, {
        method: 'POST',
        headers,
        body: form as any,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      console.log('[upload] Response status:', res.status, 'Response text:', text?.substring(0, 200));
      if (!text) {
        throw new Error(`Empty response from server (HTTP ${res.status})`);
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[upload] JSON parse error. Response text:', text);
        throw new Error(`Server returned non-JSON response (HTTP ${res.status}): ${text.substring(0, 100)}...`);
      }
      if (!res.ok) {
        const err: any = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
        err.status = res.status; err.data = data; throw err;
      }
      return data; // { url, path, type, mime, size }
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastErr = err;
      const isAbort = err.name === 'AbortError';
      const isNetwork = err instanceof TypeError && err.message === 'Network request failed';
      const isTimeout = isAbort || /timeout|timed out/i.test(String(err?.message || ''));
      const shouldRetry = attempt < retries && (isNetwork || isTimeout);
      console.error('[upload] attempt failed:', attempt + 1, '/', retries + 1, '|', isAbort ? 'timeout' : (err?.message || err));
      if (!shouldRetry) break;
      const wait = backoffMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
    }
  }
  if (lastErr?.name === 'AbortError') {
    throw new Error('Upload timed out. Please check your connection and try again.');
  }
  if (lastErr instanceof TypeError && lastErr.message === 'Network request failed') {
    throw new Error('Network error: unable to reach upload endpoint. Check your internet connection and server status.');
  }
  throw lastErr;
}

export default { uploadFile, uploadFileWithProgress };
