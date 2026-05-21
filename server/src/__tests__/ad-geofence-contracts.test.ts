import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const adsRoutes = readFileSync(join(process.cwd(), 'src', 'routes', 'ads.ts'), 'utf8');

describe('ad geofence contracts', () => {
  it('pins ad creation radius to the shared server constant', () => {
    expect(adsRoutes).toMatch(/radius:\s*AD_GEOFENCE_RADIUS_KM/);
  });

  it('does not allow clients to update ad radius directly', () => {
    const updateSchemaMatch = adsRoutes.match(
      /const adUpdateSchema = z\.object\(\{[\s\S]*?\n\}\);/
    );
    expect(updateSchemaMatch).toBeTruthy();
    expect(updateSchemaMatch?.[0] ?? '').not.toMatch(/radius:/);
    expect(adsRoutes).toMatch(
      /const \{ payment_status, status: _status, radius: _radius, \.\.\.safeBody \} = req\.body \|\| \{\};/
    );
  });

  it('uses distance filtering constant for ad feed delivery', () => {
    expect(adsRoutes).toMatch(/dist <= AD_GEOFENCE_RADIUS_MILES/);
  });
});
