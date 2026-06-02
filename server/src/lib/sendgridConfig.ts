import crypto from 'node:crypto';

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

export function getSendGridApiKeyFingerprint(apiKey: string | undefined | null): string {
  const normalized = normalizeSendGridApiKey(apiKey);
  if (!normalized) return 'missing';

  const prefix = normalized.slice(0, Math.min(7, normalized.length));
  const suffix = normalized.slice(-4);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);

  return `${prefix}...${suffix} len=${normalized.length} sha256=${hash}`;
}
