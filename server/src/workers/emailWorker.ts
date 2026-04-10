import { Worker, Job } from 'bullmq';
import { debugLog } from '../lib/debugLog.js';
import {
    sendEventApprovedEmail,
    sendEventDeniedEmail,
} from '../lib/email.js';
import type { EmailJob } from '../jobs/queues.js';

/**
 * Email queue worker (BullMQ)
 * Processes email jobs from the 'emails' queue, dispatching by job name.
 */

let worker: Worker<EmailJob> | null = null;

// Named job handlers — dispatch by job.name
const handlers: Record<string, (data: any) => Promise<any>> = {

  // Generic send (used by queueEmail fallback path)
  'send': async (data: EmailJob) => {
    const { getEmailService } = await import('../services/email/service.js');
    const emailService = getEmailService();
    let result;
    if (data.template && data.templateData) {
      result = await emailService.send({
        to: data.to,
        subject: data.subject || '',
        templateId: data.template,
        templateData: data.templateData,
      });
    } else {
      result = await emailService.send({
        to: data.to,
        subject: data.subject || '',
        text: data.text,
        html: data.html,
      });
    }
    if (!result.success) throw new Error(result.error || 'Email send failed');
    return { success: true, email: data.to, messageId: result.messageId };
  },

  // Removed: ads.reservation_received email (spam, handled in-app instead)
  'ads.reservation_received': async (data: any) => {
    // Email removed — users don't need reservation confirmation email
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  'payments.checkout_abandoned': async (data: any) => {
    // Removed: payment required email (spam, handled in-app instead)
    // Double-check payment hasn't been completed
    if (data.session_id) {
      const { prisma } = await import('../lib/prisma.js');
      const transaction = await prisma.transactionLog.findFirst({
        where: { stripe_session_id: data.session_id },
      });
      if (transaction?.status === 'COMPLETED') {
        debugLog(`[worker] Payment already completed for session ${data.session_id}, skipping reminder`);
        return { success: true, skipped: true, reason: 'payment_completed' };
      }
    }
    // Email removed — payment reminders handled in-app
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: ads.goes_live email (non-mandatory)
  'ads.goes_live': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: roster threshold alert email (non-mandatory)
  'teams.roster_threshold_alert': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: staff invitation emails (non-mandatory)
  'staff.invited_to_team': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  'staff.invitation_sent': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: report resolution email (non-mandatory)
  'reports.resolved': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: event submission received email (non-mandatory)
  'events.submission_received': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  'events.approved': async (data: any) => {
    await sendEventApprovedEmail({
      to: data.to,
      coachName: data.to_name || 'Coach',
      eventName: data.event_name,
      eventDate: data.event_start_date,
      eventTime: 'TBD',
      eventLocation: `${data.event_location_name || ''}, ${data.event_city || ''}, ${data.event_state || ''}`.trim(),
      opponent: undefined,
      organizationName: 'VarsityHub',
      approvalNotes: data.approval_notes,
      eventLink: data.view_event_url,
      manageLink: data.manage_event_url,
    });
    return { success: true, email: data.to };
  },

  'events.denied': async (data: any) => {
    await sendEventDeniedEmail({
      to: data.to,
      coachName: data.to_name || 'Coach',
      eventName: data.event_name,
      eventDate: 'N/A',
      denialReason: data.denial_reason,
      resubmitLink: data.submit_new_event_url,
      supportLink: data.contact_support_url,
      organizationName: 'VarsityHub',
    });
    return { success: true, email: data.to };
  },

  // Removed: event reminder email (non-mandatory)
  'events.reminder': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: event updated email (non-mandatory)
  'events.updated': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: event canceled email (non-mandatory)
  'events.canceled': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: seasons.wrap_up email (spam)
  'seasons.wrap_up': async (data: any) => {
    // Email removed — season wrap-up emails are spam
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: posts.milestone_reached email (spam)
  'posts.milestone_reached': async (data: any) => {
    // Email removed — post highlight emails are spam
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: follows.athlete_followed email (spam)
  'follows.athlete_followed': async (data: any) => {
    // Email removed — follower notification emails are spam
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: account recovery email (non-mandatory)
  'auth.account_recovery': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: onboarding.profile_incomplete email (spam)
  'onboarding.profile_incomplete': async (data: any) => {
    // Email removed — profile completion nudge emails are spam
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },

  // Removed: dormant user digest email (non-mandatory)
  'onboarding.dormant_user_digest': async (data: any) => {
    return { success: true, email: data.to, skipped: true, reason: 'email_removed' };
  },
};

export async function startEmailWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    debugLog('[worker] No REDIS_URL configured, email worker not started');
    return;
  }

  try {
    const { default: Redis } = await import('ioredis');
    const RedisCtor = Redis as unknown as new (url: string, options?: any) => any;
    const connection = new RedisCtor(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    worker = new Worker<EmailJob>(
      'emails',
      async (job: Job<EmailJob>) => {
        const handler = handlers[job.name];
        if (!handler) {
          console.error(`[worker] Unknown email job type: ${job.name}`);
          throw new Error(`Unknown email job type: ${job.name}`);
        }

        debugLog(`[worker] Processing ${job.name} email job ${job.id} for ${job.data.to}`);
        return handler(job.data);
      },
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 20,
          duration: 1000,
        },
      },
    );

    worker.on('completed', (job) => {
      debugLog(`[worker] Email job completed: ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[worker] Email job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
    });

    worker.on('error', (err) => {
      console.error('[worker] Email worker error:', err);
    });

    debugLog('[worker] Email worker started and listening for jobs');
  } catch (error) {
    console.error('[worker] Failed to start email worker:', error);
  }
}

export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    debugLog('[worker] Email worker stopped');
  }
}
