import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const reachPreview = read('components/ReachMapPreview.tsx');
const submitAd = read('components/SubmitAdScreenBase.tsx');
const adCalendar = read('app/ad-calendar.tsx');
const editAd = read('app/edit-ad.tsx');

describe('ad geofence UI', () => {
  it('uses the shared 9 km radius on submit and edit flows', () => {
    expect(submitAd).toMatch(/AD_GEOFENCE_RADIUS_KM/);
    expect(editAd).toMatch(/AD_GEOFENCE_RADIUS_KM/);
  });

  it('does not advertise the old 6 km or 9 mile radius in the ad flow', () => {
    expect(reachPreview).not.toContain('6 km');
    expect(reachPreview).not.toContain('9 miles');
    expect(adCalendar).not.toContain('6 km');
    expect(adCalendar).not.toContain('9 miles');
  });

  it('keeps the map preview copy tied to the entered zip code', () => {
    // Copy moved: the preview subtitle interpolates the zip; the booking
    // promise now lives on the ad-calendar confirmation copy.
    expect(reachPreview).toMatch(/of ZIP \$\{zipCode\}/);
    expect(adCalendar).toContain('Booking remains reserved for this exact zip code');
  });

  it('passes a bounded preview region to the shared map component', () => {
    // ReachMapPreview is now a thin wrapper over GeocodedMapPreview with
    // explicit bounded deltas (the old wide-default object literal is gone).
    expect(reachPreview).toContain('latitudeDelta={0.28}');
    expect(reachPreview).toContain('longitudeDelta={0.28}');
    expect(reachPreview).not.toContain('latitudeDelta: 0.28');
  });

  it('formats both mile and kilometer copy cleanly', () => {
    expect(reachPreview).toContain('miles (');
    expect(reachPreview).toContain(' km) of ZIP ${zipCode}');
    expect(reachPreview).toContain('miles / ${radiusKmLabel} km');
  });
});
