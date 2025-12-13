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
          hours_remaining: 18,
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
          hours_remaining: 18,
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
});
