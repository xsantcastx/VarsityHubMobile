import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

const routeBatteryScript = read('scripts/verify-coach-route-battery.ts');
const prepareCoachUatScript = read('scripts/prepare-coach-uat-accounts.ts');

describe('Coach route battery root-cause guards', () => {
  it('auto-prepares deterministic local UAT fixtures when localhost runs without explicit creds', () => {
    expect(routeBatteryScript).toMatch(/if \(isLocalBaseUrl\(BASE_URL\)\)/);
    expect(routeBatteryScript).toMatch(/await ensureLocalServer\(\)/);
    expect(routeBatteryScript).toMatch(/await prepareCoachUatAccounts\(\)/);
    expect(routeBatteryScript).toMatch(/COACH_ROUTE_BATTERY_LOCAL_EMAIL/);
    expect(routeBatteryScript).toMatch(/COACH_UAT_PASSWORD/);
  });

  it('starts an embedded local API when localhost verification has no running server', () => {
    expect(routeBatteryScript).toMatch(/Started embedded local API/);
    expect(routeBatteryScript).toMatch(/await import\('\.\.\/src\/testApp\.js'\)/);
    expect(routeBatteryScript).toMatch(/await shutdownEmbeddedLocalServer\(\)/);
  });

  it('keeps non-local runs strict about paired explicit credentials', () => {
    expect(routeBatteryScript).toMatch(
      /Both COACH_ROUTE_BATTERY_EMAIL and COACH_ROUTE_BATTERY_PASSWORD must be set together/
    );
    expect(routeBatteryScript).toMatch(
      /Missing required env vars: COACH_ROUTE_BATTERY_EMAIL, COACH_ROUTE_BATTERY_PASSWORD/
    );
  });

  it('exports the shared local UAT fixture identity without auto-running on import', () => {
    expect(prepareCoachUatScript).toMatch(/export const COACH_ROUTE_BATTERY_LOCAL_EMAIL/);
    expect(prepareCoachUatScript).toMatch(/export async function prepareCoachUatAccounts/);
    expect(prepareCoachUatScript).toMatch(/if \(isDirectRun\)/);
  });
});
