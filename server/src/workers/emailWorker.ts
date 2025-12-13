import { debugLog } from '../lib/debugLog.js';
import {
    sendAdGoesLiveEmail,
    sendAdReservationEmail,
    sendPaymentRequiredEmail,
    sendReportResolutionEmail,
    sendRosterThresholdAlertEmail,
    sendStaffInvitationConfirmationEmail,
    sendStaffInvitationEmail
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

// P1 Job Handlers

emailQueue.process('teams.roster_threshold_alert', async (job) => {
  const jobData = job.data as EmailJob & {
    coach_name: string;
    team_name: string;
    roster_count: number;
    threshold_cost: number;
    manage_billing_url: string;
  };

  debugLog(`[worker] Processing roster threshold alert for ${jobData.to}`);

  const result = await sendRosterThresholdAlertEmail({
    to: jobData.to,
    coachName: jobData.coach_name,
    teamName: jobData.team_name,
    rosterCount: jobData.roster_count,
    thresholdCost: jobData.threshold_cost,
    manageBillingUrl: jobData.manage_billing_url,
  });

  if (!result) {
    throw new Error(`Failed to send roster threshold alert to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('staff.invited_to_team', async (job) => {
  const jobData = job.data as EmailJob & {
    invitee_name: string;
    inviter_name: string;
    team_name: string;
    invite_link: string;
    expiry_days: number;
    onboarding_url: string;
  };

  debugLog(`[worker] Processing staff invitation email for ${jobData.to}`);

  const result = await sendStaffInvitationEmail({
    to: jobData.to,
    inviteeName: jobData.invitee_name,
    inviterName: jobData.inviter_name,
    teamName: jobData.team_name,
    inviteLink: jobData.invite_link,
    expiryDays: jobData.expiry_days,
    onboardingUrl: jobData.onboarding_url,
  });

  if (!result) {
    throw new Error(`Failed to send staff invitation email to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('staff.invitation_sent', async (job) => {
  const jobData = job.data as EmailJob & {
    coach_name: string;
    invitee_name: string;
    invitee_email: string;
    team_name: string;
    manage_staff_url: string;
  };

  debugLog(`[worker] Processing staff invitation confirmation for ${jobData.to}`);

  const result = await sendStaffInvitationConfirmationEmail({
    to: jobData.to,
    coachName: jobData.coach_name,
    inviteeName: jobData.invitee_name,
    inviteeEmail: jobData.invitee_email,
    teamName: jobData.team_name,
    manageBillingUrl: jobData.manage_staff_url,
  });

  if (!result) {
    throw new Error(`Failed to send staff invitation confirmation to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('reports.resolved', async (job) => {
  const jobData = job.data as EmailJob & {
    user_name: string;
    report_id: string;
    report_type: string;
    resolution_status: 'resolved' | 'dismissed';
    resolution_reason: string;
    appeal_url: string;
    submit_date?: string;
    resolution_date?: string;
    report_detail_link?: string;
  };

  debugLog(`[worker] Processing report resolution email for ${jobData.to}`);

  const result = await sendReportResolutionEmail({
    to: jobData.to,
    userName: jobData.user_name,
    reportId: jobData.report_id,
    reportType: jobData.report_type,
    resolutionStatus: jobData.resolution_status,
    resolutionReason: jobData.resolution_reason,
    appealUrl: jobData.appeal_url,
    submitDate: jobData.submit_date,
    resolutionDate: jobData.resolution_date,
    reportDetailLink: jobData.report_detail_link,
  });

  if (!result) {
    throw new Error(`Failed to send report resolution email to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

// P2 Job Handlers

emailQueue.process('seasons.wrap_up', async (job) => {
  const jobData = job.data as EmailJob & {
    coach_name: string;
    team_name: string;
    season_year: number;
    games_played: number;
    win_loss_record: string;
    season_highlights_url: string;
    next_season_signup_url: string;
  };

  debugLog(`[worker] Processing season wrap-up email for ${jobData.to}`);

  const result = await sendSeasonWrapUpEmail({
    to: jobData.to,
    coachName: jobData.coach_name,
    teamName: jobData.team_name,
    seasonYear: jobData.season_year,
    gamesPlayed: jobData.games_played,
    winLossRecord: jobData.win_loss_record,
    seasonHighlightsUrl: jobData.season_highlights_url,
    nextSeasonSignupUrl: jobData.next_season_signup_url,
  });

  if (!result) {
    throw new Error(`Failed to send season wrap-up email to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('posts.milestone_reached', async (job) => {
  const jobData = job.data as EmailJob & {
    creator_name: string;
    milestone_number: number;
    post_preview_url: string;
    post_title: string;
    share_link: string;
    reactions_link: string;
  };

  debugLog(`[worker] Processing post highlight email for ${jobData.to}`);

  const result = await sendPostHighlightEmail({
    to: jobData.to,
    creatorName: jobData.creator_name,
    milestoneNumber: jobData.milestone_number,
    postPreviewUrl: jobData.post_preview_url,
    postTitle: jobData.post_title,
    shareLink: jobData.share_link,
    reactionsLink: jobData.reactions_link,
  });

  if (!result) {
    throw new Error(`Failed to send post highlight email to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('follows.athlete_followed', async (job) => {
  const jobData = job.data as EmailJob & {
    athlete_name: string;
    follower_name: string;
    follower_profile_url: string;
    follow_back_link: string;
    dm_link: string;
    follower_stats: string;
  };

  debugLog(`[worker] Processing athlete follower notification for ${jobData.to}`);

  const result = await sendAthleteFollowerNotificationEmail({
    to: jobData.to,
    athleteName: jobData.athlete_name,
    followerName: jobData.follower_name,
    followerProfileUrl: jobData.follower_profile_url,
    followBackLink: jobData.follow_back_link,
    dmLink: jobData.dm_link,
    followerStats: jobData.follower_stats,
  });

  if (!result) {
    throw new Error(`Failed to send athlete follower notification to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('auth.account_recovery', async (job) => {
  const jobData = job.data as EmailJob & {
    user_name: string;
    recovery_type: 'password_reset' | 'email_change';
    recovery_time: string;
    ip_address?: string;
    undo_link?: string;
    undo_expiry_hours?: number;
    support_url: string;
  };

  debugLog(`[worker] Processing account recovery email for ${jobData.to}`);

  const result = await sendAccountRecoveryEmail({
    to: jobData.to,
    userName: jobData.user_name,
    recoveryType: jobData.recovery_type,
    recoveryTime: jobData.recovery_time,
    ipAddress: jobData.ip_address,
    undoLink: jobData.undo_link,
    undoExpiryHours: jobData.undo_expiry_hours,
    supportUrl: jobData.support_url,
  });

  if (!result) {
    throw new Error(`Failed to send account recovery email to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('onboarding.profile_incomplete', async (job) => {
  const jobData = job.data as EmailJob & {
    user_name: string;
    missing_fields: string[];
    profile_edit_url: string;
    completion_benefit: string;
    estimated_time: string;
  };

  debugLog(`[worker] Processing profile completion nudge for ${jobData.to}`);

  const result = await sendProfileCompletionNudgeEmail({
    to: jobData.to,
    userName: jobData.user_name,
    missingFields: jobData.missing_fields,
    profileEditUrl: jobData.profile_edit_url,
    completionBenefit: jobData.completion_benefit,
    estimatedTime: jobData.estimated_time,
  });

  if (!result) {
    throw new Error(`Failed to send profile completion nudge to ${jobData.to}`);
  }

  return { success: true, email: jobData.to };
});

emailQueue.process('onboarding.dormant_user_digest', async (job) => {
  const jobData = job.data as EmailJob & {
    user_name: string;
    days_absent: number;
    nearby_games_count: number;
    nearby_games_list: string;
    trending_posts_count: number;
    open_app_link: string;
    explore_link: string;
  };

  debugLog(`[worker] Processing dormant user digest for ${jobData.to}`);

  const result = await sendDormantUserDigestEmail({
    to: jobData.to,
    userName: jobData.user_name,
    daysAbsent: jobData.days_absent,
    nearbyGamesCount: jobData.nearby_games_count,
    nearbyGamesList: jobData.nearby_games_list,
    trendingPostsCount: jobData.trending_posts_count,
    openAppLink: jobData.open_app_link,
    exploreLink: jobData.explore_link,
  });

  if (!result) {
    throw new Error(`Failed to send dormant user digest to ${jobData.to}`);
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
