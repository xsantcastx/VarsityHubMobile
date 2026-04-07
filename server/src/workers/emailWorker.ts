import { Worker, Job } from 'bullmq';
import { debugLog } from '../lib/debugLog.js';
import {
    sendAccountRecoveryEmail,
    sendAdGoesLiveEmail,
    sendAdReservationEmail,
    sendAthleteFollowerNotificationEmail,
    sendDormantUserDigestEmail,
    sendEventApprovedEmail,
    sendEventCanceledEmail,
    sendEventDeniedEmail,
    sendEventReminderEmail,
    sendEventSubmissionReceivedEmail,
    sendEventUpdatedEmail,
    sendPaymentRequiredEmail,
    sendPostHighlightEmail,
    sendProfileCompletionNudgeEmail,
    sendReportResolutionEmail,
    sendRosterThresholdAlertEmail,
    sendSeasonWrapUpEmail,
    sendStaffInvitationConfirmationEmail,
    sendStaffInvitationEmail,
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

  'ads.reservation_received': async (data: any) => {
    const result = await sendAdReservationEmail({
      to: data.to,
      advertiserName: data.advertiser_name,
      businessName: data.business_name,
      reservedDates: data.reserved_dates,
      totalCost: data.total_cost,
      targetZip: data.target_zip,
      checkoutLink: data.checkout_link,
      adPreviewUrl: data.ad_preview_url,
    });
    if (!result) throw new Error(`Failed to send reservation email to ${data.to}`);
    return { success: true, email: data.to };
  },

  'payments.checkout_abandoned': async (data: any) => {
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
    const result = await sendPaymentRequiredEmail({
      to: data.to,
      advertiserName: data.advertiser_name,
      businessName: data.business_name,
      totalCost: data.total_cost,
      checkoutLink: data.checkout_link,
      hoursRemaining: data.hours_remaining,
    });
    if (!result) throw new Error(`Failed to send payment reminder email to ${data.to}`);
    return { success: true, email: data.to };
  },

  'ads.goes_live': async (data: any) => {
    const result = await sendAdGoesLiveEmail({
      to: data.to,
      advertiserName: data.advertiser_name,
      businessName: data.business_name,
      adTitle: data.ad_title,
      targetZip: data.target_zip,
      liveUntilDate: data.live_until,
      analyticsDashboardUrl: data.analytics_dashboard_url,
      adPreviewUrl: data.ad_preview_url,
    });
    if (!result) throw new Error(`Failed to send ad goes live email to ${data.to}`);
    return { success: true, email: data.to };
  },

  'teams.roster_threshold_alert': async (data: any) => {
    const result = await sendRosterThresholdAlertEmail({
      to: data.to,
      coachName: data.coach_name,
      teamName: data.team_name,
      rosterCount: data.roster_count,
      maxRosterCount: data.threshold_cost,
      manageBillingUrl: data.manage_billing_url,
    });
    if (!result) throw new Error(`Failed to send roster threshold alert to ${data.to}`);
    return { success: true, email: data.to };
  },

  'staff.invited_to_team': async (data: any) => {
    const result = await sendStaffInvitationEmail({
      to: data.to,
      inviteeName: data.invitee_name,
      inviterName: data.inviter_name,
      teamName: data.team_name,
      inviteLink: data.invite_link,
      expiryDays: data.expiry_days,
      onboardingUrl: data.onboarding_url,
    });
    if (!result) throw new Error(`Failed to send staff invitation email to ${data.to}`);
    return { success: true, email: data.to };
  },

  'staff.invitation_sent': async (data: any) => {
    const result = await sendStaffInvitationConfirmationEmail({
      to: data.to,
      coachName: data.coach_name,
      inviteeName: data.invitee_name,
      inviteeEmail: data.invitee_email,
      teamName: data.team_name,
      manageStaffUrl: data.manage_staff_url,
    });
    if (!result) throw new Error(`Failed to send staff invitation confirmation to ${data.to}`);
    return { success: true, email: data.to };
  },

  'reports.resolved': async (data: any) => {
    const result = await sendReportResolutionEmail({
      to: data.to,
      userName: data.user_name,
      reportId: data.report_id,
      reportType: data.report_type,
      resolutionStatus: data.resolution_status,
      resolutionReason: data.resolution_reason,
      appealUrl: data.appeal_url,
      submitDate: data.submit_date,
      resolutionDate: data.resolution_date,
      reportDetailLink: data.report_detail_link,
    });
    if (!result) throw new Error(`Failed to send report resolution email to ${data.to}`);
    return { success: true, email: data.to };
  },

  'events.submission_received': async (data: any) => {
    await sendEventSubmissionReceivedEmail({
      to: data.to,
      coachName: data.to_name || 'Coach',
      eventName: data.event_name,
      eventDate: data.event_start_date,
      eventTime: data.event_time || 'TBD',
      eventLocation: `${data.event_location_name}, ${data.event_city}, ${data.event_state}`,
      submissionDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      organizationName: data.organization_name || 'VarsityHub',
      statusLink: data.submission_status_url,
    });
    return { success: true, email: data.to };
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

  'events.reminder': async (data: any) => {
    await sendEventReminderEmail({
      to: data.to,
      recipientName: data.to_name || 'Team Member',
      eventName: data.event_name,
      eventDate: data.event_start_date,
      eventTime: 'TBD',
      eventLocation: `${data.event_location_name || ''}, ${data.event_city || ''}, ${data.event_state || ''}`.trim(),
      opponent: undefined,
      organizationName: 'VarsityHub',
      checkInLink: data.check_in_url,
      calendarLink: data.add_to_calendar_url,
      directionsLink: data.get_directions_url,
      preferencesLink: data.preferences_url,
    });
    return { success: true, email: data.to };
  },

  'events.updated': async (data: any) => {
    await sendEventUpdatedEmail({
      to: data.to,
      recipientName: data.to_name || 'Team Member',
      eventName: data.event_name,
      eventDate: data.event_start_date,
      eventTime: 'TBD',
      eventLocation: `${data.event_location_name || ''}, ${data.event_city || ''}, ${data.event_state || ''}`.trim(),
      organizationName: 'VarsityHub',
      updatedAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      changeSummary: data.update_summary || data.changed_fields_text || 'Event details have been updated',
      eventDetailLink: data.view_event_url,
      calendarLink: data.manage_event_url,
    });
    return { success: true, email: data.to };
  },

  'events.canceled': async (data: any) => {
    await sendEventCanceledEmail({
      to: data.to,
      recipientName: data.to_name || 'Team Member',
      eventName: data.event_name,
      eventDate: data.event_start_date,
      eventTime: 'TBD',
      eventLocation: `${data.event_location_name || ''}, ${data.event_city || ''}, ${data.event_state || ''}`.trim(),
      canceledAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      organizationName: 'VarsityHub',
      cancelReason: data.cancellation_reason,
      rescheduleInfo: undefined,
      upcomingEventsLink: data.manage_event_url || `${process.env.APP_BASE_URL || 'https://varsityhub.app'}/events`,
      contactOrganizerLink: data.contact_support_url,
    });
    return { success: true, email: data.to };
  },

  'seasons.wrap_up': async (data: any) => {
    const result = await sendSeasonWrapUpEmail({
      to: data.to,
      coachName: data.coach_name,
      teamName: data.team_name,
      seasonYear: data.season_year,
      gamesPlayed: data.games_played,
      winLossRecord: data.win_loss_record,
      seasonHighlightsUrl: data.season_highlights_url,
      nextSeasonSignupUrl: data.next_season_signup_url,
    });
    if (!result) throw new Error(`Failed to send season wrap-up email to ${data.to}`);
    return { success: true, email: data.to };
  },

  'posts.milestone_reached': async (data: any) => {
    const result = await sendPostHighlightEmail({
      to: data.to,
      creatorName: data.creator_name,
      milestoneNumber: data.milestone_number,
      postPreviewUrl: data.post_preview_url,
      postTitle: data.post_title,
      shareLink: data.share_link,
      reactionsLink: data.reactions_link,
    });
    if (!result) throw new Error(`Failed to send post highlight email to ${data.to}`);
    return { success: true, email: data.to };
  },

  'follows.athlete_followed': async (data: any) => {
    const result = await sendAthleteFollowerNotificationEmail({
      to: data.to,
      athleteName: data.athlete_name,
      followerName: data.follower_name,
      followerProfileUrl: data.follower_profile_url,
      followBackLink: data.follow_back_link,
      dmLink: data.dm_link,
      followerStats: data.follower_stats,
    });
    if (!result) throw new Error(`Failed to send athlete follower notification to ${data.to}`);
    return { success: true, email: data.to };
  },

  'auth.account_recovery': async (data: any) => {
    const result = await sendAccountRecoveryEmail(
      data.to,
      data.user_name,
      data.recovery_time,
    );
    if (!result) throw new Error(`Failed to send account recovery email to ${data.to}`);
    return { success: true, email: data.to };
  },

  'onboarding.profile_incomplete': async (data: any) => {
    const result = await sendProfileCompletionNudgeEmail({
      to: data.to,
      userName: data.user_name,
      missingFields: data.missing_fields,
      profileEditUrl: data.profile_edit_url,
      completionBenefit: data.completion_benefit,
      estimatedTime: data.estimated_time,
    });
    if (!result) throw new Error(`Failed to send profile completion nudge to ${data.to}`);
    return { success: true, email: data.to };
  },

  'onboarding.dormant_user_digest': async (data: any) => {
    const result = await sendDormantUserDigestEmail({
      to: data.to,
      userName: data.user_name,
      daysAbsent: data.days_absent,
      nearbyGamesCount: data.nearby_games_count,
      nearbyGamesList: data.nearby_games_list,
      trendingPostsCount: data.trending_posts_count,
      openAppLink: data.open_app_link,
      exploreLink: data.explore_link,
    });
    if (!result) throw new Error(`Failed to send dormant user digest to ${data.to}`);
    return { success: true, email: data.to };
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
