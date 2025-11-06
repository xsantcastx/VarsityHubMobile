import { Platform } from 'react-native';
import { getAuthToken } from './http';

function computeBase(provided?: string | null) {
  // If caller provided a base, use it
  if (provided) return provided.replace(/\/$/, '');
  
  // Use the same logic as http.ts for consistency
  const envUrl = (typeof process !== 'undefined' && (process as any).env && (process as any).env.EXPO_PUBLIC_API_URL) || '';
  const defaultUrl = __DEV__ ? 'http://localhost:4000' : 'https://api-production-8ac3.up.railway.app';
  let url = envUrl || defaultUrl;
  
  if (__DEV__ && Platform.OS === 'android' && url.startsWith('http://localhost')) {
    url = url.replace('http://localhost', 'http://10.0.2.2');
  }
  
  return url.replace(/\/$/, '');
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

export default { uploadFile };
