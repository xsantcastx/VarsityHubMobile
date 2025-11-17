import { Router } from 'express';
import { sendAbuseReportNotification } from '../lib/email.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const supportRouter = Router();

// POST /support/contact
supportRouter.post('/contact', async (req: AuthedRequest, res) => {
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
});

// POST /support/feedback
supportRouter.post('/feedback', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { user_id, category, message, screenshot_url } = (req.body || {}) as any;
  if (!category || !message) return res.status(400).json({ error: 'Invalid payload' });
  const uid = user_id === 'me' || !user_id ? req.user.id : String(user_id);
  req.log?.info?.({ type: 'support_feedback', user_id: uid, category, screenshot_url }, 'Feedback submit');
  return res.json({ ok: true });
});

