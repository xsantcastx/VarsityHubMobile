/**
 * Locks the exact HTML produced by the shared review-page module so the
 * consolidation of the coach/event/game review pages is provably byte-identical
 * to the three former per-route copies. A copy/style change must update these
 * expectations deliberately.
 */
import { describe, expect, it } from '@jest/globals';
import { renderReviewPage, renderResultPage, renderFinalStatePage } from '../lib/reviewPage.js';

const HEAD =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
const BODY_OPEN =
  '<body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;max-width:520px;margin:60px auto;padding:20px;text-align:center;">';

describe('renderReviewPage', () => {
  it('matches the former coach review page (token always present)', () => {
    expect(
      renderReviewPage({
        action: 'approve',
        entityLabel: 'Coach',
        entityName: 'Jane Doe',
        token: 'tok123',
      })
    ).toBe(
      `${HEAD}<title>Approve Coach</title></head>
${BODY_OPEN}
<h2>Approve Coach?</h2>
<p style="color:#374151;">Coach: <strong>Jane Doe</strong></p>
<form method="POST" action="?token=tok123">
<button type="submit" style="background:#16A34A;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;">Approve Coach</button>
</form>
</body></html>`
    );
  });

  it('matches the former event review page without a token (formAction "?")', () => {
    const html = renderReviewPage({ action: 'reject', entityLabel: 'Event', entityName: null });
    expect(html).toContain('<title>Reject Event</title>');
    expect(html).toContain('<h2>Reject Event?</h2>');
    expect(html).toContain('Event: <strong>Unknown</strong>');
    expect(html).toContain('<form method="POST" action="?">');
    expect(html).toContain('background:#DC2626;');
  });

  it('escapes the entity name', () => {
    const html = renderReviewPage({
      action: 'approve',
      entityLabel: 'Game',
      entityName: '<script>x</script>',
      token: 't',
    });
    expect(html).toContain('Game: <strong>&lt;script&gt;x&lt;/script&gt;</strong>');
    expect(html).toContain('action="?token=t"');
  });
});

describe('renderResultPage', () => {
  it('matches the former result page exactly (success)', () => {
    expect(renderResultPage('Already Approved', 'This event was already approved.', true)).toBe(
      `${HEAD}<title>Already Approved</title></head>
${BODY_OPEN}
<h2 style="color:#16A34A;">Already Approved</h2>
<p style="color:#374151;">This event was already approved.</p>
</body></html>`
    );
  });

  it('uses the reject color when not successful', () => {
    expect(renderResultPage('Error', 'Nope', false)).toContain(
      '<h2 style="color:#DC2626;">Error</h2>'
    );
  });
});

describe('renderFinalStatePage', () => {
  it('renders an approved final page using the entity name', () => {
    expect(
      renderFinalStatePage({
        approvalStatus: 'approved',
        entityName: 'Spring Game',
        entityNoun: 'game',
        action: 'approve',
      })
    ).toContain('Spring Game was already approved.');
  });

  it('falls back to "This <noun>" when name is absent', () => {
    expect(
      renderFinalStatePage({
        approvalStatus: 'rejected',
        entityName: null,
        entityNoun: 'event',
        action: 'reject',
      })
    ).toContain('This event was already rejected.');
  });

  it('returns null while still pending', () => {
    expect(
      renderFinalStatePage({
        approvalStatus: 'pending',
        entityName: 'X',
        entityNoun: 'event',
        action: 'approve',
      })
    ).toBeNull();
  });
});
