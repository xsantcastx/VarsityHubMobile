import { describe, expect, it } from '@jest/globals';
import { getBuildMetadata, resolveBuildSha, resolveReleaseName } from '../lib/release.js';

describe('release metadata', () => {
  it('prefers COMMIT_SHA when present', () => {
    expect(resolveBuildSha({ COMMIT_SHA: 'abc123', GITHUB_SHA: 'def456' } as NodeJS.ProcessEnv)).toBe('abc123');
  });

  it('builds an explicit release string from version and sha', () => {
    expect(
      resolveReleaseName(
        {
          npm_package_version: '1.0.2',
          COMMIT_SHA: '5358147c39927048d0d0e8b6a68db8cf36d52bc4',
        } as NodeJS.ProcessEnv,
        'varsityhub-server'
      )
    ).toBe('varsityhub-server@1.0.2+5358147c3992');
  });

  it('returns stable build metadata', () => {
    const metadata = getBuildMetadata(
      {
        NODE_ENV: 'production',
        npm_package_version: '1.0.2',
        COMMIT_SHA: '5358147c39927048d0d0e8b6a68db8cf36d52bc4',
      } as NodeJS.ProcessEnv,
      'varsityhub-server'
    );

    expect(metadata.environment).toBe('production');
    expect(metadata.sha).toBe('5358147c39927048d0d0e8b6a68db8cf36d52bc4');
    expect(metadata.release).toBe('varsityhub-server@1.0.2+5358147c3992');
    expect(typeof metadata.started_at).toBe('string');
  });
});
