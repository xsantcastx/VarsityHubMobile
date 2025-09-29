import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';

export const supportRouter = Router();

// POST /support/contact
supportRouter.post('/contact', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { name, email, subject, message } = (req.body || {}) as any;
  if (!name || !email || !subject || !message) return res.status(400).json({ error: 'Invalid payload' });
  req.log?.info?.({ type: 'support_contact', user_id: req.user.id, name, email, subject }, 'Support contact submit');
  return res.json({ ok: true });
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

