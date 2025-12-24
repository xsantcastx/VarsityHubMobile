import { Router } from 'express';
import {
    sendHostingRequestApprovedEmail,
    sendHostingRequestConfirmationEmail,
    sendHostingRequestDeniedEmail,
} from '../lib/email.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const hostingRouter = Router();

type HostingPayload = {
  organization_name?: unknown;
  contact_name?: unknown;
  contact_email?: unknown;
  venue?: unknown;
  requested_dates?: unknown;
  notes?: unknown;
};

const sanitizeString = (value: unknown, maxLength = 200) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const isValidEmail = (value: string) => /.+@.+\..+/.test(value);

function validateHostingRequest(body: HostingPayload) {
  const organization_name = sanitizeString(body.organization_name, 140);
  if (!organization_name) return { ok: false as const, error: 'organization_name required' };

  const contact_name = sanitizeString(body.contact_name, 140);
  const contact_email = sanitizeString(body.contact_email, 180);
  if (!contact_email) return { ok: false as const, error: 'contact_email required' };
  if (!isValidEmail(contact_email)) return { ok: false as const, error: 'contact_email invalid' };

  const venue = sanitizeString(body.venue, 180) || null;
  const requested_dates = sanitizeString(body.requested_dates, 180) || null;
  const notes = sanitizeString(body.notes, 500) || null;

  return {
    ok: true as const,
    data: { organization_name, contact_name, contact_email, venue, requested_dates, notes },
  };
}

const serialize = (row: any) => ({
  id: row.id,
  organization_name: row.organization_name,
  contact_name: row.contact_name,
  contact_email: row.contact_email,
  venue: row.venue,
  requested_dates: row.requested_dates,
  status: row.status,
  notes: row.notes,
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
});

hostingRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const validation = validateHostingRequest((req.body || {}) as HostingPayload);
  if (!validation.ok) return res.status(400).json({ error: validation.error });
  const { organization_name, contact_name, contact_email, venue, requested_dates, notes } = validation.data;

  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { display_name: true, email: true },
  });

  const name = contact_name || me?.display_name || 'Unknown';
  const email = contact_email || me?.email || '';
  if (!email) return res.status(400).json({ error: 'contact_email required' });

  const created = await prisma.hostingRequest.create({
    data: {
      user_id: req.user.id,
      organization_name,
      contact_name: name,
      contact_email: email,
      venue,
      requested_dates,
      notes,
      status: 'pending',
    },
  });

  // Send confirmation email to requester
  await sendHostingRequestConfirmationEmail({
    to: email,
    contactName: name,
    organizationName: organization_name,
    requestedDates: requested_dates || 'To be determined',
    statusLink: `https://limeprod.com/hosting/${created.id}`, // Update with actual domain
  });

  return res.status(201).json(serialize(created));
});

hostingRouter.get('/mine', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const items = await prisma.hostingRequest.findMany({
    where: { user_id: req.user.id },
    orderBy: { created_at: 'desc' },
  });
  return res.json(items.map(serialize));
});

hostingRouter.get('/', requireVerified as any, async (req: AuthedRequest, res) => {
  const isAdmin = await getIsAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
  const items = await prisma.hostingRequest.findMany({ orderBy: { created_at: 'desc' } });
  return res.json(items.map(serialize));
});

hostingRouter.patch('/:id/status', requireVerified as any, async (req: AuthedRequest, res) => {
  const isAdmin = await getIsAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

  const id = String(req.params.id || '');
  const status = String((req.body as any)?.status || '').trim();
  if (!['pending', 'approved', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const notes = typeof (req.body as any)?.notes === 'string' ? String((req.body as any).notes).trim() : undefined;
  try {
    const updated = await prisma.hostingRequest.update({
      where: { id },
      data: {
        status,
        ...(typeof notes === 'string' ? { notes: notes || null } : {}),
      },
    });

    // Send status change email to requester
    if (status === 'approved') {
      await sendHostingRequestApprovedEmail({
        to: updated.contact_email,
        contactName: updated.contact_name,
        organizationName: updated.organization_name,
        approvalNotes: notes || undefined,
        detailsLink: `https://limeprod.com/hosting/${updated.id}`, // Update with actual domain
      });
    } else if (status === 'denied') {
      await sendHostingRequestDeniedEmail({
        to: updated.contact_email,
        contactName: updated.contact_name,
        organizationName: updated.organization_name,
        denialReason: notes || 'Your request does not meet our current requirements.',
        supportLink: 'https://limeprod.com/support', // Update with actual domain
      });
    }

    return res.json(serialize(updated));
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    throw err;
  }
});
