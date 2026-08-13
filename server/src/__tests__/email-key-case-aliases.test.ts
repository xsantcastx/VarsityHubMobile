/**
 * expandKeyCaseAliases sends every template value under BOTH snake_case and
 * camelCase, so hosted-template casing drift can't blank out fields. Guards the
 * fix for the screenshot-confirmed blank-email bug (project memory:
 * email-template-var-drift).
 */
import { describe, expect, it } from '@jest/globals';
import { expandKeyCaseAliases } from '../lib/email.js';

describe('expandKeyCaseAliases', () => {
  it('adds a camelCase alias for snake_case keys', () => {
    const out = expandKeyCaseAliases({ coach_name: 'A', event_date: 'B' });
    expect(out.coach_name).toBe('A');
    expect(out.coachName).toBe('A');
    expect(out.event_date).toBe('B');
    expect(out.eventDate).toBe('B');
  });

  it('adds a snake_case alias for camelCase keys', () => {
    const out = expandKeyCaseAliases({ organizationName: 'X' });
    expect(out.organizationName).toBe('X');
    expect(out.organization_name).toBe('X');
  });

  it('never overwrites an explicitly-provided alias (semantic renames win)', () => {
    const out = expandKeyCaseAliases({ view_event_url: 'snake', viewEventUrl: 'explicit' });
    expect(out.viewEventUrl).toBe('explicit');
    expect(out.view_event_url).toBe('snake');
  });

  it('leaves single-word keys unchanged (no spurious aliases)', () => {
    const out = expandKeyCaseAliases({ opponent: 'TBD', reason: 'r' });
    expect(Object.keys(out).sort()).toEqual(['opponent', 'reason']);
  });

  it('preserves values and original keys', () => {
    const input = { user_name: 'Jordan', report_id: 'RPT-1' };
    const out = expandKeyCaseAliases(input);
    expect(out.user_name).toBe('Jordan');
    expect(out.userName).toBe('Jordan');
    expect(out.report_id).toBe('RPT-1');
    expect(out.reportId).toBe('RPT-1');
  });
});
