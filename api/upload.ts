import { getApiBaseUrl, getAuthToken } from './http';

function computeBase(provided?: string | null) {
  if (provided) return provided.replace(/\/$/, '');
  return getApiBaseUrl();
}

export async function uploadFile(baseUrl: string | null | undefined, uri: string, filename?: string, mimeType?: string): Promise<any> {
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

  try {
    console.log('[upload] Uploading to:', target);
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
    console.error('[upload] error uploading to', target, err?.message || err);
    if (err instanceof TypeError && err.message === 'Network request failed') {
      throw new Error('Network error: unable to reach upload endpoint. Check your internet connection and server status.');
    }
    throw err;
  }
}

export async function uploadAvatar(uri: string, filename?: string): Promise<{ url: string }> {
  const finalBase = computeBase(null);
  const target = `${finalBase}/upload/avatar`;

  const form = new FormData();
  form.append('file', {
    uri,
    name: filename || `avatar_${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as any);

  const headers: any = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    console.log('[upload] Uploading avatar to:', target);
    const res = await fetch(target, {
      method: 'POST',
      headers,
      body: form as any,
    });
    
    if (!res.ok) {
      const text = await res.text();
      const err: any = new Error(`Avatar upload failed: ${text || res.statusText}`);
      err.status = res.status;
      throw err;
    }
    
    return await res.json();
  } catch (err: any) {
    console.error('[upload] Avatar upload error:', err?.message || err);
    if (err instanceof TypeError && err.message === 'Network request failed') {
      throw new Error('Network error: unable to reach server. Check your connection.');
    }
    throw err;
  }
}

export default { uploadFile, uploadAvatar };
