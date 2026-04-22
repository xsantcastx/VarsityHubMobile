import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('upload guardrails', () => {
  it('edit-profile materializes iCloud assets before avatar/background manipulation', () => {
    const source = readRepoFile('app/(tabs)/edit-profile.tsx');

    expect(source).toContain("import { materializeICloudAssetIfNeeded } from '@/utils/materializeICloudAsset';");
    expect(source.match(/const localUri = await materializeICloudAssetIfNeeded\(uri\);/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toMatch(/manipulateAsync\(\s*localUri,/);
  });

  it('edit-ad materializes iCloud assets before banner manipulation', () => {
    const source = readRepoFile('app/edit-ad.tsx');

    expect(source).toContain("import { materializeICloudAssetIfNeeded } from '@/utils/materializeICloudAsset';");
    expect(source).toContain('const localUri = await materializeICloudAssetIfNeeded(a.uri);');
    expect(source).toContain('ImageManipulator.manipulateAsync(localUri');
  });
});

describe('notification badge guardrails', () => {
  it('push notification handler keeps badge updates enabled', () => {
    const source = readRepoFile('utils/pushNotifications.ts');

    expect(source).toContain('shouldSetBadge: true');
    expect(source).toContain('export async function syncNotificationBadge()');
    expect(source).toContain('export async function clearNotificationBadge()');
  });

  it('notifications screen syncs and clears badge state', () => {
    const source = readRepoFile('app/(tabs)/notifications/index.tsx');

    expect(source).toContain("import { clearNotificationBadge, syncNotificationBadge } from '@/utils/pushNotifications';");
    expect(source).toContain('void syncNotificationBadge();');
    expect(source).toContain('await clearNotificationBadge();');
  });
});
