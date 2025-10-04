import { Platform } from 'react-native';
import { getAuthToken } from './http';

function computeBase(provided?: string | null) {
  // If caller provided a base, use it
  if (provided) return provided.replace(/\/$/, '');
  // Try env injected by Expo
  try {
    const envBase = (typeof process !== 'undefined' && (process.env as any)?.EXPO_PUBLIC_API_URL) || (global as any)?.EXPO_PUBLIC_API_URL;
    if (envBase) return String(envBase).replace(/\/$/, '');
  } catch (e) {
    // ignore
  }
  // Platform fallbacks
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
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

  console.log('[upload] POST', target, { filename, mimeType, tokenPresent: !!token });

  try {
    console.log('[upload] Making fetch request...');
    const res = await fetch(target, {
      method: 'POST',
      headers,
      body: form as any,
    });
    console.log('[upload] Response received:', { status: res.status, statusText: res.statusText, ok: res.ok });
    
    const text = await res.text();
    console.log('[upload] Response text:', text);
    
    const data = text ? JSON.parse(text) : null;
    console.log('[upload] Parsed response data:', data);
    
    if (!res.ok) {
      const err: any = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
      err.status = res.status; err.data = data; throw err;
    }
    console.log('[upload] Upload successful, returning data:', data);
    return data; // { url, path, type, mime, size }
  } catch (err: any) {
    console.error('[upload] error uploading to', target, err?.message || err);
    console.error('[upload] full error object:', err);
    if (err instanceof TypeError && err.message === 'Network request failed') {
      throw new Error('Network error: unable to reach upload endpoint. Ensure EXPO_PUBLIC_API_URL is set correctly for your device/emulator and the dev server is running.');
    }
    throw err;
  }
}

export default { uploadFile };
