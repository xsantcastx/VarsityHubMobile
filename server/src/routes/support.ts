import { Router } from 'express';
import { sendAbuseReportNotification } from '../lib/email.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const supportRouter = Router();

// POST /support/contact
supportRouter.post('/contact', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { name, email, subject, message } = (req.body || {}) as any;
    if (!name || !email || !subject || !message) return res.status(400).json({ error: 'Invalid payload' });

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
supportRouter.post('/feedback', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { category, message, screenshot_url } = (req.body || {}) as any;
    if (!category || !message) return res.status(400).json({ error: 'Invalid payload' });
    const uid = req.user.id;
    req.log?.info?.({ type: 'support_feedback', user_id: uid, category, screenshot_url }, 'Feedback submit');
    return res.json({ ok: true });
  } catch (err) {
    console.error('[support] POST /feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

