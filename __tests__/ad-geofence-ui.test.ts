import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const reachPreview = read('components/ReachMapPreview.tsx');
const submitAd = read('components/SubmitAdScreenBase.tsx');
const submitAdWeb = read('app/submit-ad.web.tsx');
const adCalendar = read('app/ad-calendar.tsx');
const editAd = read('app/edit-ad.tsx');
const editAdWeb = read('app/edit-ad.web.tsx');
const myAds = read('app/my-ads.tsx');
const adminAds = read('app/admin-ads.tsx');
const paymentSuccess = read('app/payment-success.tsx');
const adConfirmation = read('app/ad-confirmation.tsx');

describe('ad geofence UI', () => {
  it('uses the shared 9 km radius on submit and edit flows', () => {
    expect(submitAd).toMatch(/AD_GEOFENCE_RADIUS_KM/);
    expect(editAd).toMatch(/AD_GEOFENCE_RADIUS_KM/);
  });

  it('keeps web submit/edit geofence preview parity with native flows', () => {
    expect(submitAdWeb).toMatch(/showReachPreview=\{true\}/);
    expect(editAdWeb).toMatch(/renderReachPreview/);
    expect(editAdWeb).toMatch(/AD_GEOFENCE_RADIUS_KM/);
  });

  it('does not advertise the old 6 km or 9 mile radius in the ad flow', () => {
    expect(reachPreview).not.toContain('6 km');
    expect(reachPreview).not.toContain('9 miles');
    expect(adCalendar).not.toContain('6 km');
    expect(adCalendar).not.toContain('9 miles');
  });

  it('keeps the map preview copy tied to the entered zip code', () => {
    expect(reachPreview).toMatch(/Booking stays tied to this ZIP code/);
  });

  it('shows the 9 km reach contract on ad-facing detail screens', () => {
    expect(myAds).toMatch(/Reach \{AD_GEOFENCE_RADIUS_KM\} km around this ZIP/);
    expect(adminAds).toMatch(/Reach: \{AD_GEOFENCE_RADIUS_KM\} km around target ZIP/);
    expect(paymentSuccess).toMatch(/\{AD_GEOFENCE_RADIUS_KM\} km reach/);
    expect(adConfirmation).toMatch(/\{AD_GEOFENCE_RADIUS_KM\} km around ZIP \{coverageZip\}/);
  });

  it('uses a computed preview region instead of the old wide default deltas', () => {
    expect(reachPreview).toMatch(/getAdReachPreviewRegion/);
    expect(reachPreview).not.toContain('latitudeDelta: 0.6');
  });
});
