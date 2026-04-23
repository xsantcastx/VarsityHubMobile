export function resolveHealthCheckSecret(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const direct = env.HEALTH_CHECK_SECRET?.trim();
  if (direct) return direct;

  const legacySpaced = env['HEALTH_CHECK_SECRET ']?.trim();
  if (legacySpaced) return legacySpaced;

  for (const [key, value] of Object.entries(env)) {
    if (key.trim() !== 'HEALTH_CHECK_SECRET') continue;
    const normalized = value?.trim();
    if (normalized) return normalized;
  }

  return undefined;
}
