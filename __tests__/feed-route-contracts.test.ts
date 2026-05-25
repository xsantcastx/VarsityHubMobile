import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const routeSource = readFileSync(join(ROOT, 'app/feed.tsx'), 'utf8');

describe('feed route contracts', () => {
  it('routes app/feed through the canonical feature screen instead of duplicating the implementation', () => {
    expect(routeSource.trim()).toBe(
      "export { default } from './features/navigation/screens/FeedScreen';"
    );
  });
});
