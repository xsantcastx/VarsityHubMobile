import { readFileSync } from 'node:fs';
import path from 'node:path';

const feedSource = readFileSync(path.join(process.cwd(), 'app/feed.tsx'), 'utf8');

describe('feed map controls contract', () => {
  it('labels the map entry as games nearby', () => {
    expect(feedSource).toContain('View Games Nearby');
    expect(feedSource).toContain('accessibilityLabel="View games nearby"');
    expect(feedSource).not.toContain('View Events Map');
  });

  it('renders the shared sport filter under the map button and applies it to feed rows', () => {
    expect(feedSource).toContain("import SportFilterBar from '@/components/SportFilterBar'");
    expect(feedSource).toContain('const [selectedFeedSport, setSelectedFeedSport]');
    expect(feedSource).toContain('<SportFilterBar');
    expect(feedSource).toContain('selected={selectedFeedSport}');
    expect(feedSource).toContain('onSelect={setSelectedFeedSport}');
    expect(feedSource).toContain('getFeedItemSport(game) === selectedFeedSport');
  });
});
