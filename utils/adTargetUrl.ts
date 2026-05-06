export function normalizeAdTargetUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  if (/^https:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function isValidAdTargetUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return /^https:\/\/.+/i.test(normalizeAdTargetUrl(trimmed));
}
