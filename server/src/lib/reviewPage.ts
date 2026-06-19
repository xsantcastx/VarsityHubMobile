/**
 * Shared HTML for the email-link review pages used by the approve/reject flows:
 *   - coach review  (routes/admin.ts)
 *   - event review  (routes/events.ts)
 *   - game review   (routes/games.ts)
 *
 * These were three byte-identical copies of the same markup (review page, result
 * page, already-final page). Consolidating here keeps the pages that the email
 * approve/deny buttons land on in lockstep — a style or copy change happens once.
 *
 * Output is intentionally byte-for-byte identical to the previous per-route
 * functions; see reviewPage.test.ts which locks the exact HTML.
 */
import escapeHtml from 'escape-html';

const APPROVE_COLOR = '#16A34A';
const REJECT_COLOR = '#DC2626';

/** Confirmation page with a single POST button (what the email link GET renders). */
export function renderReviewPage(opts: {
  action: 'approve' | 'reject';
  entityLabel: string; // 'Coach' | 'Event' | 'Game'
  entityName: string | null;
  token?: string;
}): string {
  const title = `${opts.action === 'approve' ? 'Approve' : 'Reject'} ${opts.entityLabel}`;
  const color = opts.action === 'approve' ? APPROVE_COLOR : REJECT_COLOR;
  const formAction = opts.token ? `?token=${encodeURIComponent(opts.token)}` : '?';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:60px auto;padding:20px;text-align:center;">
<h2>${title}?</h2>
<p style="color:#374151;">${opts.entityLabel}: <strong>${escapeHtml(opts.entityName || 'Unknown')}</strong></p>
<form method="POST" action="${formAction}">
<button type="submit" style="background:${color};color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;">${title}</button>
</form>
</body></html>`;
}

/** Terminal result page shown after an action (or for an error). */
export function renderResultPage(title: string, message: string, success: boolean): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:60px auto;padding:20px;text-align:center;">
<h2 style="color:${success ? APPROVE_COLOR : REJECT_COLOR};">${escapeHtml(title)}</h2>
<p style="color:#374151;">${escapeHtml(message)}</p>
</body></html>`;
}

/**
 * "Already approved/rejected" page for an idempotent re-click. Returns null when
 * the entity is still pending (caller proceeds to render the review/action page).
 */
export function renderFinalStatePage(opts: {
  approvalStatus: string | null;
  entityName: string | null;
  entityNoun: string; // 'event' | 'game'
  action: 'approve' | 'reject';
}): string | null {
  const name = opts.entityName || `This ${opts.entityNoun}`;
  if (opts.approvalStatus === 'approved') {
    return renderResultPage(
      'Already Approved',
      `${name} was already approved.`,
      opts.action === 'approve'
    );
  }
  if (opts.approvalStatus === 'rejected') {
    return renderResultPage(
      'Already Rejected',
      `${name} was already rejected.`,
      opts.action === 'reject'
    );
  }
  return null;
}
