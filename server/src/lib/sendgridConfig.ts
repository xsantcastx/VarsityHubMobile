export function normalizeSendGridApiKey(apiKey: string | undefined | null): string {
  return typeof apiKey === 'string' ? apiKey.trim() : '';
}

export function isPlaceholderSendGridApiKey(apiKey: string | undefined | null): boolean {
  const normalized = normalizeSendGridApiKey(apiKey).toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes('your') ||
    normalized.includes('here') ||
    normalized.includes('placeholder') ||
    normalized.includes('example') ||
    normalized.includes('changeme') ||
    normalized.includes('replace-me') ||
    normalized.includes('test-key')
  );
}

export function isValidSendGridApiKey(apiKey: string | undefined | null): boolean {
  const normalized = normalizeSendGridApiKey(apiKey);
  if (!normalized.startsWith('SG.')) return false;
  if (normalized.length < 20) return false;
  if (isPlaceholderSendGridApiKey(normalized)) return false;
  return true;
}
