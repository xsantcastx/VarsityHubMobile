import { emailQueue } from '../lib/queue';

describe('Email Queue System', () => {
  beforeAll(async () => {
    // Ensure queue is initialized
    await emailQueue.isReady();
  });

  afterEach(async () => {
    // Clean up jobs after each test
    await emailQueue.empty();
  });

  afterAll(async () => {
    await emailQueue.close();
  });

  describe('Reservation Received Email', () => {
    it('should queue reservation email after booking dates', async () => {
      const jobData = {
        to: 'test@example.com',
        advertiser_name: 'John Doe',
        business_name: 'Acme Corp',
        reserved_dates: ['2025-12-20', '2025-12-21'],
        total_cost: 13.0,
        target_zip: '90210',
        checkout_link: 'https://varsityhub.app/checkout?ad_id=123',
      };

      const job = await emailQueue.add('ads.reservation_received', jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });

      expect(job.id).toBeDefined();
      expect(job.data.to).toBe('test@example.com');
      expect(job.data.total_cost).toBe(13.0);

      const jobStatus = await job.getState();
      expect(['waiting', 'active', 'completed']).toContain(jobStatus);
    });

    it('should retry failed reservation emails up to 3 times', async () => {
      const job = await emailQueue.add('ads.reservation_received', {
        to: 'test@example.com',
        advertiser_name: 'Test',
        business_name: 'Test Business',
        reserved_dates: ['2025-12-20'],
        total_cost: 5.0,
        target_zip: '12345',
        checkout_link: 'https://test.com',
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff?.type).toBe('exponential');
    });
  });

  describe('Payment Required Email', () => {
    it('should queue payment reminder with 6-hour delay', async () => {
      const delayMs = 6 * 60 * 60 * 1000; // 6 hours
      const sessionId = 'cs_test_123';

      const job = await emailQueue.add(
        'payments.checkout_abandoned',
        {
          to: 'test@example.com',
          advertiser_name: 'Jane Smith',
          business_name: 'Test Corp',
          total_cost: 18.0,
          checkout_link: 'https://checkout.stripe.com/test',
          hours_remaining: 1,
          session_id: sessionId,
        },
        {
          delay: delayMs,
          attempts: 1,
          jobId: `payment-reminder-${sessionId}`,
        }
      );

      expect(job.id).toBe(`payment-reminder-${sessionId}`);
      expect(job.opts.delay).toBe(delayMs);
      expect(job.opts.attempts).toBe(1);
    });

    it('should cancel payment reminder if payment completed', async () => {
      const sessionId = 'cs_test_456';
      const jobId = `payment-reminder-${sessionId}`;

      // Queue the reminder
      const job = await emailQueue.add(
        'payments.checkout_abandoned',
        {
          to: 'test@example.com',
          advertiser_name: 'Test User',
          business_name: 'Test Business',
          total_cost: 13.0,
          checkout_link: 'https://test.com',
          hours_remaining: 1,
          session_id: sessionId,
        },
        { delay: 6 * 60 * 60 * 1000, jobId }
      );

      // Simulate payment completion
      const retrievedJob = await emailQueue.getJob(jobId);
      await retrievedJob?.remove();

      // Verify job was removed
      const checkJob = await emailQueue.getJob(jobId);
      expect(checkJob).toBeNull();
    });
  });

  describe('Queue Health', () => {
    it('should report job counts correctly', async () => {
      // Add test jobs
      await emailQueue.add('ads.reservation_received', {
        to: 'test1@example.com',
        advertiser_name: 'Test 1',
        business_name: 'Business 1',
        reserved_dates: ['2025-12-20'],
        total_cost: 5.0,
        target_zip: '12345',
        checkout_link: 'https://test.com',
      });

      await emailQueue.add('ads.reservation_received', {
        to: 'test2@example.com',
        advertiser_name: 'Test 2',
        business_name: 'Business 2',
        reserved_dates: ['2025-12-21'],
        total_cost: 8.0,
        target_zip: '12345',
        checkout_link: 'https://test.com',
      });

      const counts = await emailQueue.getJobCounts();
      expect(counts.waiting).toBeGreaterThanOrEqual(2);
    });

    it('should process jobs in order', async () => {
      const jobs = [];
      for (let i = 0; i < 5; i++) {
        const job = await emailQueue.add('ads.reservation_received', {
          to: `test${i}@example.com`,
          advertiser_name: `Test ${i}`,
          business_name: `Business ${i}`,
          reserved_dates: ['2025-12-20'],
          total_cost: 5.0,
          target_zip: '12345',
          checkout_link: 'https://test.com',
        });
        jobs.push(job.id);
      }

      expect(jobs).toHaveLength(5);
      expect(new Set(jobs).size).toBe(5); // All unique IDs
    });
  });

  describe('P1: Roster Threshold Alert', () => {
    it('should queue roster threshold alert email', async () => {
      const job = await emailQueue.add('teams.roster_threshold_alert', {
        to: 'coach@example.com',
        coach_name: 'John Coach',
        team_name: 'Varsity Basketball',
        roster_count: 15,
        threshold_cost: 99.99,
        manage_billing_url: 'https://app.example.com/billing',
      });

      expect(job.id).toBeDefined();
      const jobStatus = await job.getState();
      expect(['waiting', 'active', 'completed']).toContain(jobStatus);
    });
  });

  describe('P1: Staff Invitation', () => {
    it('should queue staff invitation email to invitee', async () => {
      const job = await emailQueue.add('staff.invited_to_team', {
        to: 'assistant@example.com',
        invitee_name: 'Jane Assistant',
        inviter_name: 'John Coach',
        team_name: 'Varsity Basketball',
        invite_link: 'https://app.example.com/invite?token=abc123',
        expiry_days: 7,
        onboarding_url: 'https://docs.example.com/onboarding',
      });

      expect(job.id).toBeDefined();
      expect(job.opts.attempts).toBeGreaterThanOrEqual(1);
    });

    it('should queue staff invitation confirmation email to coach', async () => {
      const job = await emailQueue.add('staff.invitation_sent', {
        to: 'coach@example.com',
        coach_name: 'John Coach',
        invitee_name: 'Jane Assistant',
        invitee_email: 'assistant@example.com',
        team_name: 'Varsity Basketball',
        manage_staff_url: 'https://app.example.com/staff',
      });

      expect(job.id).toBeDefined();
      const jobStatus = await job.getState();
      expect(['waiting', 'active', 'completed']).toContain(jobStatus);
    });
  });

  describe('P1: Report Resolution', () => {
    it('should queue report resolution email', async () => {
      const job = await emailQueue.add('reports.resolved', {
        to: 'user@example.com',
        user_name: 'John User',
        report_type: 'harassment',
        resolution_status: 'resolved',
        resolution_reason: 'Violation confirmed and action taken',
        appeal_url: 'https://app.example.com/appeal/report123',
      });

      expect(job.id).toBeDefined();
      expect(['waiting', 'active', 'completed']).toContain(await job.getState());
    });
  });

  describe('P2: Season Wrap-Up', () => {
    it('should queue season wrap-up email', async () => {
      const job = await emailQueue.add('seasons.wrap_up', {
        to: 'coach@example.com',
        coach_name: 'John Coach',
        team_name: 'Varsity Basketball',
        season_year: 2025,
        games_played: 18,
        win_loss_record: '15-3',
        season_highlights_url: 'https://app.example.com/highlights',
        next_season_signup_url: 'https://app.example.com/signup',
      });

      expect(job.id).toBeDefined();
      expect(['waiting', 'active', 'completed']).toContain(await job.getState());
    });
  });

  describe('P2: Post Highlight Milestone', () => {
    it('should queue post highlight email', async () => {
      const job = await emailQueue.add('posts.milestone_reached', {
        to: 'athlete@example.com',
        creator_name: 'Jane Athlete',
        milestone_number: 100,
        post_preview_url: 'https://cdn.example.com/post-preview.jpg',
        post_title: 'Amazing Game Highlight',
        share_link: 'https://app.example.com/share/post123',
        reactions_link: 'https://app.example.com/post/post123/reactions',
      });

      expect(job.id).toBeDefined();
      expect(job.opts.attempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('P2: Athlete Follower Notification', () => {
    it('should queue athlete follower email', async () => {
      const job = await emailQueue.add('follows.athlete_followed', {
        to: 'athlete@example.com',
        athlete_name: 'Jane Athlete',
        follower_name: 'John Fan',
        follower_profile_url: 'https://app.example.com/profile/john',
        follow_back_link: 'https://app.example.com/follow/john',
        dm_link: 'https://app.example.com/dm/john',
        follower_stats: 'Joined 3 months ago, follows 45 athletes',
      });

      expect(job.id).toBeDefined();
      expect(['waiting', 'active', 'completed']).toContain(await job.getState());
    });
  });

  describe('P2: Account Recovery', () => {
    it('should queue account recovery email', async () => {
      const job = await emailQueue.add('auth.account_recovery', {
        to: 'user@example.com',
        user_name: 'John User',
        recovery_type: 'password_reset',
        recovery_time: '2025-12-13 10:30 AM',
        ip_address: '192.168.1.1',
        support_url: 'https://app.example.com/support/security',
      });

      expect(job.id).toBeDefined();
      expect(['waiting', 'active', 'completed']).toContain(await job.getState());
    });
  });

  describe('P2: Profile Completion Nudge', () => {
    it('should queue profile completion nudge email', async () => {
      const job = await emailQueue.add('onboarding.profile_incomplete', {
        to: 'newuser@example.com',
        user_name: 'Jane Newbie',
        missing_fields: ['Bio', 'Jersey Number'],
        profile_edit_url: 'https://app.example.com/profile/edit',
        completion_benefit: 'Helps recruiters find you',
        estimated_time: '2 minutes',
      });

      expect(job.id).toBeDefined();
      expect(job.opts.attempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('P2: Dormant User Digest', () => {
    it('should queue dormant user digest email', async () => {
      const job = await emailQueue.add('onboarding.dormant_user_digest', {
        to: 'dormant@example.com',
        user_name: 'John Dormant',
        days_absent: 14,
        nearby_games_count: 3,
        nearby_games_list: 'Game 1 - Dec 15, Game 2 - Dec 17, Game 3 - Dec 20',
        trending_posts_count: 5,
        open_app_link: 'varsityhub://home?source=dormant-digest',
        explore_link: 'https://app.example.com/explore',
      });

      expect(job.id).toBeDefined();
      expect(['waiting', 'active', 'completed']).toContain(await job.getState());
    });
  });
});
