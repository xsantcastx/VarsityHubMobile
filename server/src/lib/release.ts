const PROCESS_STARTED_AT = new Date().toISOString();

const BUILD_SHA_KEYS = [
  'COMMIT_SHA',
  'RAILWAY_GIT_COMMIT_SHA',
  'GITHUB_SHA',
  'SOURCE_VERSION',
] as const;

const trimToNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function resolveBuildSha(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const key of BUILD_SHA_KEYS) {
    const value = trimToNull(env[key]);
    if (value) return value;
  }
  return null;
}

export function resolveReleaseName(
  env: NodeJS.ProcessEnv = process.env,
  serviceName = 'varsityhub-server'
): string | null {
  const explicitRelease = trimToNull(env.SENTRY_RELEASE);
  if (explicitRelease) return explicitRelease;

  const version = trimToNull(env.npm_package_version);
  const sha = resolveBuildSha(env);

  if (version && sha) {
    return `${serviceName}@${version}+${sha.slice(0, 12)}`;
  }
  if (version) {
    return `${serviceName}@${version}`;
  }
  if (sha) {
    return `${serviceName}@${sha.slice(0, 12)}`;
  }
  return null;
}

export function getBuildMetadata(
  env: NodeJS.ProcessEnv = process.env,
  serviceName = 'varsityhub-server'
) {
  return {
    sha: resolveBuildSha(env),
    release: resolveReleaseName(env, serviceName),
    started_at: PROCESS_STARTED_AT,
    environment: trimToNull(env.NODE_ENV) || 'development',
  };
}
