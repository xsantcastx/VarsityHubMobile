import { readFileSync } from 'fs';
import { join } from 'path';

const postDetailSrc = readFileSync(join(process.cwd(), 'app', 'post-detail.tsx'), 'utf8');

describe('PDF regression — post detail scroll jump controls', () => {
  it('tracks active scroll metrics before rendering jump controls', () => {
    expect(postDetailSrc).toMatch(/activeScrollViewRef/);
    expect(postDetailSrc).toMatch(/hasOverflowingContent/);
    expect(postDetailSrc).toMatch(/setActiveScrollViewportHeight/);
    expect(postDetailSrc).toMatch(/setActiveScrollContentHeight/);
    expect(postDetailSrc).toMatch(/setActiveScrollOffsetY/);
  });

  it('renders accessible scroll-to-top and scroll-to-bottom actions', () => {
    expect(postDetailSrc).toMatch(/accessibilityLabel="Scroll to top"/);
    expect(postDetailSrc).toMatch(/accessibilityLabel="Scroll to bottom"/);
    expect(postDetailSrc).toMatch(
      /activeScrollViewRef\.current\?\.scrollTo\(\{ y: 0, animated: true \}\)/
    );
    expect(postDetailSrc).toMatch(
      /activeScrollViewRef\.current\?\.scrollTo\(\{ y: maxActiveScrollY, animated: true \}\)/
    );
  });
});
