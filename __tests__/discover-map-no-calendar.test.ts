/**
 * Contract: the Discover calendar renders in exactly ONE place — the list view.
 *
 * The map view must be a map, not a calendar stacked above a map (owner
 * complaint: "the calendar takes up the entire screen"). The feed map and the
 * Discover calendar are deliberately separate systems; the Discover map must
 * never re-grow an inline `renderCalendar()` above its `<EventMap>`.
 *
 * This is a source-structure guard because the screen is too large to unit
 * render. If a second calendar call-site is ever added, this fails and forces a
 * conscious decision rather than silent drift.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(
  join(__dirname, '..', 'app', '(tabs)', 'discover', 'mobile-community.tsx'),
  'utf8'
);

describe('Discover map view', () => {
  it('renders the calendar in exactly one place (list view, never on the map)', () => {
    // `renderCalendar()` matches call-sites only; the definition is
    // `const renderCalendar = () =>` which has no `()` immediately after the name.
    const callSites = SOURCE.match(/\brenderCalendar\(\)/g) ?? [];
    expect(callSites).toHaveLength(1);
  });
});
