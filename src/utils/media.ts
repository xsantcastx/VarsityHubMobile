import { getApiBaseUrl } from '@/api/http';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

export function normalizeMediaUrl(input?: string | null): string | null {
  if (!input) return null;
  let url = input.trim();
  if (!url) return null;

  const base = getApiBaseUrl();

  if (url.startsWith('/uploads/')) {
    return `${base}${url}`;
  }
  if (url.startsWith('uploads/')) {
    return `${base}/${url}`;
  }

  try {
    const parsed = new URL(url);
    if (LOCAL_HOSTS.has(parsed.hostname)) {
      const baseParsed = new URL(base);
      parsed.protocol = baseParsed.protocol;
      parsed.host = baseParsed.host;
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
