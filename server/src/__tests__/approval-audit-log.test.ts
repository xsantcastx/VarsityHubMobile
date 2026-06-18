/**
 * Approval audit-log invariants.
 *
 * Standard: every admin/coach approval action emits an AdminActivityLog row
 * (actor/action/target/timestamp). Ad and event approvals previously emitted
 * none — these static checks lock the fix in. (Booting Express in Jest is blocked
 * by an ESM config issue tracked separately; source scanning is the cheap,
 * reliable guard used across the suite — see coach-flow-invariants.test.ts.)
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const ads = read('src/routes/ads.ts');
const events = read('src/routes/events.ts');

describe('approval actions emit AdminActivityLog (financial/admin traceability)', () => {
  it('ad approval logs an ad_approved admin activity', () => {
    expect(ads).toMatch(/logAdminActivity(FromReq)?\([\s\S]*?['"]ad_approved['"]/);
  });

  it('ad rejection logs an ad_rejected admin activity', () => {
    expect(ads).toMatch(/logAdminActivity(FromReq)?\([\s\S]*?['"]ad_rejected['"]/);
  });

  it('ad audit covers both session and email-token reviewer paths', () => {
    // logAdminActivityFromReq for the session path, logAdminActivity for token.
    expect(/logAdminActivityFromReq\(/.test(ads)).toBe(true);
    expect(/logAdminActivity\(\s*['"]email-token['"]/.test(ads)).toBe(true);
  });

  it('event approval logs an event_approved admin activity', () => {
    expect(events).toMatch(/logAdminActivityFromReq\([\s\S]*?['"]event_approved['"]/);
  });

  it('event rejection logs an event_rejected admin activity', () => {
    expect(events).toMatch(/logAdminActivityFromReq\([\s\S]*?['"]event_rejected['"]/);
  });
});
