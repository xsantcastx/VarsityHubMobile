/**
 * Email date rendering — SendGrid has no `formatDate` helper, so every template
 * that renders a date must receive either a pre-formatted `*_display` string or
 * a value already formatted in the event's timezone. These contract tests pin
 * the server side so a template only ever prints a ready-to-show string.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const email = readFileSync(join(process.cwd(), 'src', 'lib', 'email.ts'), 'utf8');
const games = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');

describe('email templates receive pre-formatted dates', () => {
  it('password-changed email sends changed_at_display via formatEventTime', () => {
    expect(email).toMatch(/changed_at_display: formatEventTime\(/);
  });

  it('event-updated email sends a timezone-aware new_date_display', () => {
    expect(email).toMatch(
      /new_date_display: params\.newDate\s*\?\s*formatEventTime\(params\.newDate, params\.timezone\)/
    );
  });

  it('event-updated caller forwards the event timezone', () => {
    expect(games).toMatch(/timezone: updated\.timezone \?\? null/);
  });
});

describe('event approval/denial emails format dates in the event timezone', () => {
  it('computes a shared, timezone-aware eventWhen from formatEventTime', () => {
    expect(games).toMatch(
      /const eventWhen = eventDate \? formatEventTime\(eventDate, updatedGame\.timezone\)/
    );
  });

  it('no longer formats those emails with a timezone-less toLocaleDateString', () => {
    // Both the approved and denied calls used toLocale* with no timeZone,
    // which rendered the server's UTC time. They must use eventWhen now.
    expect(games).toMatch(/eventDate: eventWhen\?\.dateStr/);
    expect(games).toMatch(/eventTime: eventWhen\?\.timeStr/);
  });
});
