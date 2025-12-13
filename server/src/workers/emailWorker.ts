import { debugLog } from '../lib/debugLog.js';
import {
    sendAdGoesLiveEmail,
    sendAdReservationEmail,
    sendPaymentRequiredEmail,
} from '../lib/email.js';
import { emailQueue } from '../lib/queue.js';

/**
 * Email queue worker
 * Processes email jobs from the queue
 */

interface EmailJob {
  type: string;
  to: string;
  [key: string]: any;
}

// Process email jobs
emailQueue.process('ads.reservation_received', async (job) => {
  const jobData = job.data as EmailJob & {
    advertiser_name: string;
    business_name: string;
    reserved_dates: string[];
    total_cost: number;
    target_zip: string;
    checkout_link: string;
    ad_preview_url?: string;
  };

  debugLog(`[worker] Processing reservation email for ${jobData.to}`);

  const result = await sendAdReservationEmail({
    to: jobData.to,
    advertiserName: jobData.advertiser_name,
    businessName: jobData.business_name,
    reservedDates: jobData.reserved_dates,
    totalCost: jobData.total_cost,
    targetZip: jobData.target_zip,
    checkoutLink: jobData.checkout_link,
    adPreviewUrl: jobData.ad_preview_url,
  });

  if (!result) {
    throw new Error(`Failed to send reservation email to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('payments.checkout_abandoned', async (job) => {
  const jobData = job.data as EmailJob & {
    advertiser_name: string;
    business_name: string;
    total_cost: number;
    checkout_link: string;
    hours_remaining: number;
    session_id?: string;
  };

  debugLog(`[worker] Processing payment reminder email for ${jobData.to}`);

  // Double-check that payment hasn't been completed (job should have been cancelled, but defensive check)
  if (jobData.session_id) {
    const { prisma } = await import('../lib/prisma.js');
    const transaction = await prisma.transaction.findFirst({
      where: { stripe_session_id: jobData.session_id },
    });
    
    if (transaction?.status === 'COMPLETED') {
      debugLog(`[worker] Payment already completed for session ${jobData.session_id}, skipping reminder`);
      return { success: true, skipped: true, reason: 'payment_completed' };
    }
  }

  const result = await sendPaymentRequiredEmail({
    to: jobData.to,
    advertiserName: jobData.advertiser_name,
    businessName: jobData.business_name,
    totalCost: jobData.total_cost,
    checkoutLink: jobData.checkout_link,
    hoursRemaining: jobData.hours_remaining,
  });

  if (!result) {
    throw new Error(`Failed to send payment reminder email to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('ads.goes_live', async (job) => {
  const jobData = job.data as EmailJob & {
    advertiser_name: string;
    business_name: string;
    ad_title: string;
    target_zip: string;
    live_until: string;
    analytics_dashboard_url: string;
    ad_preview_url?: string;
  };

  debugLog(`[worker] Processing ad goes live email for ${jobData.to}`);

  const result = await sendAdGoesLiveEmail({
    to: jobData.to,
    advertiserName: jobData.advertiser_name,
    businessName: jobData.business_name,
    adTitle: jobData.ad_title,
    targetZip: jobData.target_zip,
    liveUntilDate: jobData.live_until,
    analyticsDashboardUrl: jobData.analytics_dashboard_url,
    adPreviewUrl: jobData.ad_preview_url,
  });

  if (!result) {
    throw new Error(`Failed to send ad goes live email to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

export async function startEmailWorker(): Promise<void> {
  debugLog('✅ Email worker started and listening for jobs');
}

export async function stopEmailWorker(): Promise<void> {
  await emailQueue.close();
  debugLog('[worker] Email worker stopped');
}
