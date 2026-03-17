import { Router } from 'express';
import { z } from 'zod';
import { sendAbuseReportNotification } from '../lib/email.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { supportLimiter } from '../middleware/rateLimiters.js';

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  subject: z.string().min(1).max(500),
  message: z.string().min(1).max(5000),
});

const feedbackSchema = z.object({
  category: z.string().min(1).max(100),
  message: z.string().min(1).max(5000),
  screenshot_url: z.string().url().max(2048).optional(),
});

export const supportRouter = Router();

// POST /support/contact
supportRouter.post('/contact', supportLimiter, requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = contactSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { name, email, subject, message } = parsed.data;

    // Log the report
    req.log?.info?.({ type: 'support_contact', user_id: req.user.id, name, email, subject }, 'Support contact submit');

    // Save to database for admin review
    const report = await prisma.abuseReport.create({
      data: {
        reporter_id: req.user.id,
        reporter_name: name,
        reporter_email: email,
        subject,
        message,
        status: 'pending',
      },
    });

    // Send email notification to customer service (async, don't block response)
    sendAbuseReportNotification({
      reporterName: name,
      reporterEmail: email,
      subject,
      message,
      userId: req.user.id,
    }).catch(err => {
      console.error('Failed to send abuse report email:', err);
    });

    return res.json({ ok: true, reportId: report.id });
  } catch (err) {
    console.error('[support] POST /contact error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /support/feedback
supportRouter.post('/feedback', supportLimiter, requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = feedbackSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { category, message, screenshot_url } = parsed.data;
    const uid = req.user.id;
    req.log?.info?.({ type: 'support_feedback', user_id: uid, category, screenshot_url }, 'Feedback submit');
    return res.json({ ok: true });
  } catch (err) {
    console.error('[support] POST /feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

