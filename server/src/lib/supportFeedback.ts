import { prisma } from './prisma.js';
import { sendAbuseReportEmail } from './email.js';
import { captureException } from './sentry.js';

/** Storage is the receipt; notification failure must never lose the user's message. */
export async function recordSupportFeedback(
  userId: string,
  input: {
    category: string;
    message: string;
    screenshot_url?: string;
    submission_id?: string;
  }
) {
  const reporter = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { display_name: true, email: true },
  });
  const data = {
    reporter_id: userId,
    reporter_name: reporter.display_name || 'VarsityHub user',
    reporter_email: reporter.email,
    subject: `Feedback: ${input.category}`,
    message:
      input.message + (input.screenshot_url ? `\n\nScreenshot: ${input.screenshot_url}` : ''),
    status: 'pending',
    ...(input.submission_id
      ? { target_type: 'support_feedback', target_id: input.submission_id }
      : {}),
  };
  let report;
  try {
    report = await prisma.abuseReport.create({ data });
  } catch (error) {
    if (input.submission_id && (error as { code?: string })?.code === 'P2002') {
      const existing = await prisma.abuseReport.findUnique({
        where: {
          reporter_id_target_type_target_id: {
            reporter_id: userId,
            target_type: 'support_feedback',
            target_id: input.submission_id,
          },
        },
        select: { id: true },
      });
      // A retry is the same receipt, not another notification or a message edit.
      if (existing) return existing.id;
    }
    throw error;
  }
  // EmailService already owns provider retries. The legacy email queue has no worker.
  void sendAbuseReportEmail({
    to: process.env.SUPPORT_EMAIL || 'customerservice@varsityhub.app',
    reporterName: report.reporter_name,
    reporterEmail: report.reporter_email,
    reportedContentType: 'support_feedback',
    reportedContentId: report.id,
    reportReason: report.subject,
    reportDetails: report.message,
    reportId: report.id,
  })
    .then(sent => {
      if (!sent) throw new Error('Feedback notification was not delivered');
    })
    .catch(error =>
      captureException(error, {
        context: 'support_feedback_notification_failed',
        reportId: report.id,
      })
    );
  return report.id;
}
