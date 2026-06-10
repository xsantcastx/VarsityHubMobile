import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const highlightsScreen = readFileSync(join(process.cwd(), 'app', 'highlights.tsx'), 'utf8');

describe('highlights event navigation contract', () => {
  it('keeps event search results tappable with the keyboard open and routes event-only results to event detail', () => {
    expect(highlightsScreen).toContain('Keyboard.dismiss();');
    expect(highlightsScreen).toContain(
      "import { buildEventDetailRoute } from '@/utils/eventRoutes';"
    );
    expect(highlightsScreen).toContain('router.push(buildEventDetailRoute(eventId))');
    expect(highlightsScreen).not.toContain(
      "pathname: '/game', params: { eventId: String(eventId) }"
    );
    expect(highlightsScreen).toContain('keyboardShouldPersistTaps="handled"');
  });
});
