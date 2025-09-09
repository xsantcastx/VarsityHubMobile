import { getAuthToken } from './http';

export async function uploadFile(baseUrl: string, uri: string, filename?: string, mimeType?: string): Promise<any> {
  const form = new FormData();
  form.append('file', {
    uri,
    name: filename || 'upload',
    type: mimeType || 'application/octet-stream',
  } as any);

  const headers: any = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/uploads`, {
    method: 'POST',
    headers,
    body: form as any,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err: any = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    err.status = res.status; err.data = data; throw err;
  }
  return data; // { url, path, type, mime, size }
}

export default { uploadFile };

