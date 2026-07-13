export function redactEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return 'unknown';
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return 'redacted';

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const localPreview = local.length <= 2 ? `${local.charAt(0) || '*'}*` : `${local.slice(0, 2)}***`;
  const [domainName, ...domainRest] = domain.split('.');
  const domainPreview = domainName ? `${domainName.slice(0, 2)}***` : '***';
  const suffix = domainRest.length > 0 ? `.${domainRest.join('.')}` : '';
  return `${localPreview}@${domainPreview}${suffix}`;
}

export function redactIdentifier(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return 'unknown';
  const trimmed = value.trim();
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***`;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
