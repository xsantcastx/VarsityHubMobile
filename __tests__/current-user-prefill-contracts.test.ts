import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const reportAbuseScreen = read('app/report-abuse.tsx');
const postDetailScreen = read('app/post-detail.tsx');

describe('current user prefill contracts', () => {
  it('report-abuse prefills reporter identity from auth state instead of refetching /me', () => {
    expect(reportAbuseScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(reportAbuseScreen).toContain('const me: any = await getAuthSnapshot(checkAuth, user);');
    expect(reportAbuseScreen).not.toContain('const me: any = await User.me();');
  });

  it('post-detail loads the current viewer from auth state instead of refetching /me', () => {
    expect(postDetailScreen).toContain('const { user, checkAuth } = useAuth();');
    expect(postDetailScreen).toContain(
      'const currentUser = (await getAuthSnapshot(checkAuth, user)) as any;'
    );
    expect(postDetailScreen).not.toContain('const user = await User.me();');
  });
});
