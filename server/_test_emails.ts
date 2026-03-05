/**
 * Test script: Captures the HTML and JSON data for 3 email functions
 * Uses EMAIL_PROVIDER=test so no real SendGrid key is needed.
 * Run: EMAIL_PROVIDER=test npx tsx server/_test_emails.ts
 */
import { writeFileSync } from 'fs';

// Force test provider before anything else loads
process.env.EMAIL_PROVIDER = 'test';

// Now import the email service and monkey-patch it
const { getEmailService } = await import('./src/services/email/service.js');
const svc = getEmailService();

const captured: Array<{ name: string; to: string; subject: string; html: string; text: string }> = [];

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

// ── Email 1: Event Submission Received ──
console.log('\n=== 1. sendEventSubmissionReceivedEmail ===');
const { sendEventSubmissionReceivedEmail } = await import('./src/lib/email.js');
const r1 = await sendEventSubmissionReceivedEmail({
  to: TO,
  coachName: 'Coach Mancero',
  eventTitle: 'Spring Showcase Tournament',
  eventDate: 'Saturday, March 15, 2026',
  eventTime: '2:00 PM',
  eventLocation: 'Varsity Hub Sports Complex, Dallas TX',
  statusLink: 'https://varsityhub.app/events/my-events',
  reviewTimelineHours: 24,
});
if (captured.length > 0) captured[captured.length - 1].name = 'event-submission-received';
console.log('Result:', r1);
console.log('Subject:', captured[captured.length - 1]?.subject);
console.log('To:', captured[captured.length - 1]?.to);

// ── Email 2: Event Reminder ──
console.log('\n=== 2. sendEventReminderEmail ===');
const { sendEventReminderEmail } = await import('./src/lib/email.js');
const r2 = await sendEventReminderEmail({
  to: TO,
  recipientName: 'Coach Mancero',
  eventTitle: 'Spring Showcase Tournament',
  eventDate: 'Saturday, March 15, 2026',
  eventTime: '2:00 PM',
  eventLocation: 'Varsity Hub Sports Complex, Dallas TX',
  eventId: 'evt_test_123',
  checkInLink: 'https://varsityhub.app/event-detail?id=evt_test_123',
  calendarLink: 'https://varsityhub.app/event-detail?id=evt_test_123',
  directionsLink: 'https://maps.google.com/?q=Varsity+Hub+Sports+Complex+Dallas+TX',
  preferencesLink: 'https://varsityhub.app/settings',
});
if (captured.length > 1) captured[captured.length - 1].name = 'event-reminder';
console.log('Result:', r2);
console.log('Subject:', captured[captured.length - 1]?.subject);
console.log('To:', captured[captured.length - 1]?.to);

// ── Email 3: Ad Goes Live ──
console.log('\n=== 3. sendAdGoesLiveEmail ===');
const { sendAdGoesLiveEmail } = await import('./src/lib/email.js');
const r3 = await sendAdGoesLiveEmail({
  to: TO,
  advertiserName: 'Coach Mancero',
  businessName: 'VarsityHub Athletics',
  adTitle: 'Spring Training Camp 2026',
  targetZip: '75001',
  liveUntil: 'March 22, 2026',
  analyticsDashboardUrl: 'https://varsityhub.app/my-ads',
  adPreviewUrl: 'https://varsityhub.app/ad-preview?id=ad_test_123',
});
if (captured.length > 2) captured[captured.length - 1].name = 'ad-goes-live';
console.log('Result:', r3);
console.log('Subject:', captured[captured.length - 1]?.subject);
console.log('To:', captured[captured.length - 1]?.to);

// ── Write HTML files for visual verification ──
console.log('\n=== Writing HTML files ===');
for (const email of captured) {
  const htmlPath = `/tmp/email-${email.name}.html`;
  const jsonPath = `/tmp/email-${email.name}.json`;
  writeFileSync(htmlPath, email.html);
  writeFileSync(jsonPath, JSON.stringify({ to: email.to, subject: email.subject, textFallback: email.text }, null, 2));
  console.log(`  ${email.name}: ${htmlPath}`);
}

console.log('\n=== Summary ===');
console.log(`Total emails captured: ${captured.length}`);
console.log('All emails would be sent to:', TO);
for (const e of captured) {
  console.log(`  [${e.name}] Subject: "${e.subject}" | HTML: ${e.html.length} chars | Text: ${e.text.length} chars`);
}

process.exit(0);
