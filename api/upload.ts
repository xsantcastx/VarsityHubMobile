import { getApiBaseUrl, getAuthToken } from './http';

function computeBase(provided?: string | null) {
  if (provided) return provided.replace(/\/$/, '');
  return getApiBaseUrl();
}

export async function uploadFile(baseUrl: string | null | undefined, uri: string, filename?: string, mimeType?: string, options?: { retries?: number; backoffMs?: number }): Promise<any> {
  const finalBase = computeBase(baseUrl);
  const target = `${finalBase}/uploads`;

  const form = new FormData();
  form.append('file', {
    uri,
    name: filename || 'upload',
    type: mimeType || 'application/octet-stream',
  } as any);

  const headers: any = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const retries = Math.max(0, options?.retries ?? 2);
  const backoffMs = Math.max(50, options?.backoffMs ?? 500);
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= retries) {
    try {
      console.log('[upload] Uploading to:', target, '| attempt', attempt + 1, '/', retries + 1, '| file:', filename, '| mime:', mimeType);
      const res = await fetch(target, {
        method: 'POST',
        headers,
        body: form as any,
      });
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
      lastErr = err;
      const isNetwork = err instanceof TypeError && err.message === 'Network request failed';
      const isTimeout = /timeout|timed out/i.test(String(err?.message || ''));
      const shouldRetry = attempt < retries && (isNetwork || isTimeout);
      console.error('[upload] attempt failed:', attempt + 1, '/', retries + 1, '|', err?.message || err);
      if (!shouldRetry) break;
      const wait = backoffMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
    }
  }
  if (lastErr instanceof TypeError && lastErr.message === 'Network request failed') {
    throw new Error('Network error: unable to reach upload endpoint. Check your internet connection and server status.');
  }
  throw lastErr;
}

export default { uploadFile };
