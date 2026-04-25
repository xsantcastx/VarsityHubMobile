/**
 * Captures the rendered HTML / JSON for a representative slice of the
 * server's transactional emails. Useful for visual review (open the
 * generated /tmp/email-*.html in a browser) and for diffing against
 * SendGrid template renders.
 *
 * Run: EMAIL_PROVIDER=test npx tsx server/_test_emails.ts
 *
 * Uses EMAIL_PROVIDER=test so no real SendGrid key is needed; the send
 * method is monkey-patched to capture instead of dispatch.
 *
 * Previous version of this file imported sendEventSubmissionReceivedEmail
 * and sendEventReminderEmail — both removed during a prior email-flow
 * refactor. Replaced with three currently-exported functions that span
 * the major templates (auth, event, ads).
 */
import { writeFileSync } from 'fs';

// Force test provider before anything else loads
process.env.EMAIL_PROVIDER = 'test';

// Now import the email service and monkey-patch it
const { getEmailService } = await import('./src/services/email/service.js');
const svc = getEmailService();

const captured: Array<{
  name: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}> = [];

// Override the send method to capture the HTML/text instead of just logging
const origSend = svc.send.bind(svc);
svc.send = async (params: any) => {
  captured.push({
    name: 'pending',
    to: params.to,
    subject: params.subject,
    html: params.html || '',
    text: params.text || '',
  });
  return { success: true, provider: 'test', messageId: 'test-' + Date.now() };
};

const TO = 'emancero@varsityhub.app';

// ── Email 1: Verification (every signup hits this) ──
console.log('\n=== 1. sendVerificationEmail ===');
const { sendVerificationEmail } = await import('./src/lib/email.js');
const r1 = await sendVerificationEmail(TO, 'test-token-abc123', 'Coach Mancero');
if (captured.length > 0) captured[captured.length - 1].name = 'verification';
console.log('Result:', r1);
console.log('Subject:', captured[captured.length - 1]?.subject);

// ── Email 2: Event Approved ──
console.log('\n=== 2. sendEventApprovedEmail ===');
const { sendEventApprovedEmail } = await import('./src/lib/email.js');
const r2 = await sendEventApprovedEmail({
  to: TO,
  coachName: 'Coach Mancero',
  eventTitle: 'Spring Showcase Tournament',
  eventDate: 'Saturday, March 15, 2026',
  eventTime: '2:00 PM',
  eventLocation: 'Varsity Hub Sports Complex, Dallas TX',
  eventId: 'evt_test_123',
});
if (captured.length > 1) captured[captured.length - 1].name = 'event-approved';
console.log('Result:', r2);
console.log('Subject:', captured[captured.length - 1]?.subject);

// ── Email 3: Ad Approved ──
console.log('\n=== 3. sendAdApprovedEmail ===');
const { sendAdApprovedEmail } = await import('./src/lib/email.js');
const r3 = await sendAdApprovedEmail({
  to: TO,
  businessName: 'VarsityHub Athletics',
  note: 'Spring Training Camp 2026 — your ad goes live in 1 hour.',
});
if (captured.length > 2) captured[captured.length - 1].name = 'ad-approved';
console.log('Result:', r3);
console.log('Subject:', captured[captured.length - 1]?.subject);

// ── Write HTML files for visual verification ──
console.log('\n=== Writing HTML files ===');
for (const email of captured) {
  const htmlPath = `/tmp/email-${email.name}.html`;
  const jsonPath = `/tmp/email-${email.name}.json`;
  writeFileSync(htmlPath, email.html);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      { to: email.to, subject: email.subject, textFallback: email.text },
      null,
      2
    )
  );
  console.log(`  ${email.name}: ${htmlPath}`);
}

console.log('\n=== Summary ===');
console.log(`Total emails captured: ${captured.length}`);
console.log('All emails would be sent to:', TO);
for (const e of captured) {
  console.log(
    `  [${e.name}] Subject: "${e.subject}" | HTML: ${e.html.length} chars | Text: ${e.text.length} chars`
  );
}

process.exit(0);
