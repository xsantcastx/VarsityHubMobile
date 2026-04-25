export const CANONICAL_EMAIL_FROM = 'noreply@varsityhub.app';

export function resolveEmailFrom(
  env: Pick<NodeJS.ProcessEnv, 'EMAIL_FROM' | 'FROM_EMAIL'> = process.env
): string {
  const emailFrom = (env.EMAIL_FROM || '').trim();
  const fromEmail = (env.FROM_EMAIL || '').trim();
  return emailFrom || fromEmail || CANONICAL_EMAIL_FROM;
}

export function isCanonicalEmailFrom(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === CANONICAL_EMAIL_FROM;
}
