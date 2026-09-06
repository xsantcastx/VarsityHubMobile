import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Isolate outbound adapters; exercise the current HTTP router without contacting providers.
const persist = jest.fn(async (args: any) => ({ id: 'audit-report', ...args.data }));
const findExisting = jest.fn(async () => ({ id: 'audit-report' }));
const capture = jest.fn();
jest.unstable_mockModule('../lib/sentry.js', () => ({ captureException: capture }));
const notify = jest.fn(async () => true);
jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    abuseReport: { create: persist, findUnique: findExisting },
    user: {
      findUniqueOrThrow: jest.fn(async () => ({
        display_name: 'Audit',
        email: 'audit@example.com',
      })),
    },
  },
}));
jest.unstable_mockModule('../lib/email.js', () => ({ sendAbuseReportEmail: notify }));
jest.unstable_mockModule('../middleware/rateLimiters.js', () => ({
  supportLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const { supportRouter } = await import('../routes/support.js');
const log = jest.fn();
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  Object.assign(req, { user: { id: 'audit-user' }, log: { info: log } });
  next();
});
app.use('/support', supportRouter);

describe('Monitoring audit: feedback delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('durably records feedback before acknowledging receipt', async () => {
    const message = 'Synthetic audit: the map crashes when reopened.';
    const res = await request(app).post('/support/feedback').send({ category: 'bug', message });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, reportId: 'audit-report' });
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message, reporter_id: 'audit-user' }),
      })
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(message);
  });

  it('keeps receipt valid and captures unsuccessful notification', async () => {
    notify.mockResolvedValueOnce(false);
    const res = await request(app)
      .post('/support/feedback')
      .send({ category: 'bug', message: 'A bug' });
    expect(res.body.reportId).toBe('audit-report');
    expect(capture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'support_feedback_notification_failed' })
    );
  });
  it('does not acknowledge or notify when storage fails', async () => {
    persist.mockRejectedValueOnce(new Error('database unavailable'));
    const res = await request(app)
      .post('/support/feedback')
      .send({ category: 'bug', message: 'A bug' });
    expect(res.status).toBe(500);
    expect(notify).not.toHaveBeenCalled();
  });
  it('scopes retry idempotency to the authenticated reporter without repeating notification', async () => {
    persist.mockRejectedValueOnce(Object.assign(new Error('Duplicate'), { code: 'P2002' }));
    const res = await request(app).post('/support/feedback').send({
      category: 'bug',
      message: 'A bug',
      user_id: 'foreign',
      submission_id: 'b277ef56-8c97-4e47-ae62-dfa98ae245c9',
    });
    expect(res.status).toBe(200);
    expect(notify).not.toHaveBeenCalled();
    expect(findExisting).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reporter_id_target_type_target_id: {
            reporter_id: 'audit-user',
            target_type: 'support_feedback',
            target_id: 'b277ef56-8c97-4e47-ae62-dfa98ae245c9',
          },
        },
        select: { id: true },
      })
    );
  });
  it('rejects off-platform screenshots before saving', async () => {
    const res = await request(app).post('/support/feedback').send({
      category: 'bug',
      message: 'A bug',
      screenshot_url: 'https://attacker.example/a.png',
    });
    expect(res.status).toBe(400);
    expect(persist).not.toHaveBeenCalled();
  });
  it('contrasts the contact route: persists the message and invokes notification', async () => {
    const message = 'Synthetic audit contact message';
    const res = await request(app).post('/support/contact').send({
      name: 'Audit',
      email: 'audit@example.com',
      subject: 'Monitoring audit',
      message,
    });
    expect(res.status).toBe(200);
    expect(res.body.reportId).toBe('audit-report');
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message }),
      })
    );
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
