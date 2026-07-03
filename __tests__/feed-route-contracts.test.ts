import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const routeSource = readFileSync(join(ROOT, 'app/feed.tsx'), 'utf8');
const tabsBridgeSource = readFileSync(join(ROOT, 'app/(tabs)/feed/index.tsx'), 'utf8');

describe('feed route contracts', () => {
  it('hosts the canonical feed implementation at app/feed.tsx with the tab route bridging to it', () => {
    // app/feed.tsx is the single live implementation (the legacy
    // app/features/navigation/screens/FeedScreen.tsx was relocated here).
    expect(routeSource).toContain('export default function FeedScreen');
    expect(routeSource).not.toContain('features/navigation');
    // The (tabs) route stays a one-line bridge — one implementation, no duplication.
    expect(tabsBridgeSource.trim()).toBe("export { default } from '../../feed';");
  });
});
