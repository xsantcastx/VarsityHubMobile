/**
 * EVENT MANAGEMENT EMAIL INTEGRATION
 * Production-ready code to wire all 6 event emails into your backend
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy the emailWorker jobs into server/src/workers/emailWorker.ts (DONE ✓)
 * 2. Copy test routes into server/src/routes/test-emails.ts
 * 3. Add route integration examples to server/src/routes/events.ts
 * 4. Add utility functions to server/src/lib/utils.ts (create if missing)
 * 5. Create cron job at server/src/jobs/eventReminders.ts
 * 6. Register cron in server/src/index.ts
 * 7. Run database migration SQL
 * 8. Add environment variables to Railway
 */

// ============================================================================
// FILE 1: server/src/workers/emailWorker.ts
// ============================================================================
// ALREADY ADDED ✓ - The 6 event job processors are now in your emailWorker.ts

// ============================================================================
// FILE 2: server/src/routes/test-emails.ts (ADD TO EXISTING FILE)
// ============================================================================

// Add these test endpoints to your existing test-emails.ts file:

import { Router } from 'express';
import { emailQueue } from '../lib/queue.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const testEmailsRouter = Router();

// ... existing test endpoints ...

// Test Event Submission Received
testEmailsRouter.post('/event-submission', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  await emailQueue.add('events.submission_received', {
    to: req.user.email,
    to_name: req.user.display_name || 'Coach',
    event_id: 'evt_test_123',
    event_name: 'Spring Championship Tournament',
    event_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    event_location_name: 'Central Sports Complex',
    event_city: 'Austin',
    event_state: 'TX',
    submission_status_url: `${process.env.APP_BASE_URL}/events/evt_test_123/status`,
    review_timeline_hours: 48,
  });

  return res.json({ success: true, message: 'Event submission email queued' });
});

// Test Event Approved
testEmailsRouter.post('/event-approved', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  await emailQueue.add('events.approved', {
    to: req.user.email,
    to_name: req.user.display_name || 'Coach',
    event_id: 'evt_test_123',
    event_name: 'Spring Championship Tournament',
    event_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    event_location_name: 'Central Sports Complex',
    event_city: 'Austin',
    event_state: 'TX',
    view_event_url: `${process.env.APP_BASE_URL}/events/evt_test_123`,
    manage_event_url: `${process.env.APP_BASE_URL}/events/evt_test_123/edit`,
    approval_notes: 'Great event! Looking forward to it.',
  });

  return res.json({ success: true, message: 'Event approved email queued' });
});

// Test Event Denied
testEmailsRouter.post('/event-denied', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  await emailQueue.add('events.denied', {
    to: req.user.email,
    to_name: req.user.display_name || 'Coach',
    event_id: 'evt_test_123',
    event_name: 'Spring Championship Tournament',
    denial_reason: 'Event does not meet community guidelines. Please ensure event description includes safety protocols and age requirements.',
    submit_new_event_url: `${process.env.APP_BASE_URL}/events/new`,
    contact_support_url: `${process.env.APP_BASE_URL}/support`,
  });

  return res.json({ success: true, message: 'Event denied email queued' });
});

// Test Event Reminder
testEmailsRouter.post('/event-reminder', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  await emailQueue.add('events.reminder', {
    to: req.user.email,
    to_name: req.user.display_name || 'Fan',
    event_id: 'evt_test_123',
    event_name: 'Spring Championship Tournament',
    event_start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    event_location_name: 'Central Sports Complex',
    event_city: 'Austin',
    event_state: 'TX',
    check_in_url: `${process.env.APP_BASE_URL}/events/evt_test_123/check-in`,
    add_to_calendar_url: `${process.env.APP_BASE_URL}/events/evt_test_123/calendar`,
    get_directions_url: `https://maps.google.com/?q=Central+Sports+Complex+Austin+TX`,
    preferences_url: `${process.env.APP_BASE_URL}/settings/notifications`,
  });

  return res.json({ success: true, message: 'Event reminder email queued' });
});

// Test Event Updated
testEmailsRouter.post('/event-updated', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  await emailQueue.add('events.updated', {
    to: req.user.email,
    to_name: req.user.display_name || 'Fan',
    event_id: 'evt_test_123',
    event_name: 'Spring Championship Tournament',
    event_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    event_location_name: 'Central Sports Complex - Field 3',
    event_city: 'Austin',
    event_state: 'TX',
    update_summary: 'Event location changed to Field 3',
    changed_fields_text: 'Location, Start Time',
    view_event_url: `${process.env.APP_BASE_URL}/events/evt_test_123`,
    manage_event_url: `${process.env.APP_BASE_URL}/events/evt_test_123/edit`,
  });

  return res.json({ success: true, message: 'Event updated email queued' });
});

// Test Event Canceled
testEmailsRouter.post('/event-canceled', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  await emailQueue.add('events.canceled', {
    to: req.user.email,
    to_name: req.user.display_name || 'Fan',
    event_id: 'evt_test_123',
    event_name: 'Spring Championship Tournament',
    event_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    event_location_name: 'Central Sports Complex',
    event_city: 'Austin',
    event_state: 'TX',
    cancellation_reason: 'Due to weather conditions, this event has been canceled. We will reschedule soon.',
    contact_support_url: `${process.env.APP_BASE_URL}/support`,
    manage_event_url: `${process.env.APP_BASE_URL}/events`,
  });

  return res.json({ success: true, message: 'Event canceled email queued' });
});

// Test ALL event emails at once
testEmailsRouter.post('/event-all', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const testData = {
    to: req.user.email,
    to_name: req.user.display_name || 'Test User',
    event_id: 'evt_test_123',
    event_name: 'Spring Championship Tournament',
    event_start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    event_location_name: 'Central Sports Complex',
    event_city: 'Austin',
    event_state: 'TX',
  };

  await Promise.all([
    emailQueue.add('events.submission_received', {
      ...testData,
      submission_status_url: `${process.env.APP_BASE_URL}/events/evt_test_123/status`,
      review_timeline_hours: 48,
    }),
    emailQueue.add('events.approved', {
      ...testData,
      view_event_url: `${process.env.APP_BASE_URL}/events/evt_test_123`,
      manage_event_url: `${process.env.APP_BASE_URL}/events/evt_test_123/edit`,
    }),
    emailQueue.add('events.denied', {
      ...testData,
      denial_reason: 'Test denial reason',
      submit_new_event_url: `${process.env.APP_BASE_URL}/events/new`,
      contact_support_url: `${process.env.APP_BASE_URL}/support`,
    }),
    emailQueue.add('events.reminder', {
      ...testData,
      check_in_url: `${process.env.APP_BASE_URL}/events/evt_test_123/check-in`,
      add_to_calendar_url: `${process.env.APP_BASE_URL}/events/evt_test_123/calendar`,
      get_directions_url: `https://maps.google.com/?q=Central+Sports+Complex`,
      preferences_url: `${process.env.APP_BASE_URL}/settings/notifications`,
    }),
    emailQueue.add('events.updated', {
      ...testData,
      update_summary: 'Location changed',
      changed_fields_text: 'Location',
      view_event_url: `${process.env.APP_BASE_URL}/events/evt_test_123`,
      manage_event_url: `${process.env.APP_BASE_URL}/events/evt_test_123/edit`,
    }),
    emailQueue.add('events.canceled', {
      ...testData,
      cancellation_reason: 'Weather conditions',
      contact_support_url: `${process.env.APP_BASE_URL}/support`,
    }),
  ]);

  return res.json({ success: true, message: '6 event emails queued successfully' });
});

// ============================================================================
// FILE 3: server/src/routes/events.ts (ROUTE INTEGRATION EXAMPLES)
// ============================================================================

// Add these imports at the top of events.ts:
import { emailQueue } from '../lib/queue.js';
import { formatEventDate } from '../lib/utils.js';

// EXAMPLE 1: Queue submission email when event is created
// Add this AFTER the event is created in your POST / handler:

const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '') || 'https://varsityhub.app';

// After: const event = await prisma.event.create({ ... });
await emailQueue.add('events.submission_received', {
  to: user.email,
  to_name: user.display_name,
  event_id: event.id,
  event_name: event.title,
  event_start_date: event.date.toISOString(),
  event_location_name: event.location || undefined,
  event_city: undefined, // Extract from location if needed
  event_state: undefined, // Extract from location if needed
  submission_status_url: `${appBaseUrl}/events/${event.id}`,
  review_timeline_hours: 48,
});

// EXAMPLE 2: Queue approved/denied email when admin reviews event
// Add this to your PATCH /:id/approve or PATCH /:id/review handler:

// After approval:
if (approval_status === 'approved') {
  await emailQueue.add('events.approved', {
    to: creator.email,
    to_name: creator.display_name,
    event_id: event.id,
    event_name: event.title,
    event_start_date: event.date.toISOString(),
    event_location_name: event.location || undefined,
    event_city: undefined,
    event_state: undefined,
    view_event_url: `${appBaseUrl}/events/${event.id}`,
    manage_event_url: `${appBaseUrl}/events/${event.id}/edit`,
    approval_notes: req.body.notes || undefined,
  });
}

// After denial:
if (approval_status === 'rejected' || approval_status === 'denied') {
  await emailQueue.add('events.denied', {
    to: creator.email,
    to_name: creator.display_name,
    event_id: event.id,
    event_name: event.title,
    denial_reason: req.body.rejection_reason || 'Event does not meet community guidelines.',
    submit_new_event_url: `${appBaseUrl}/events/new`,
    contact_support_url: `${appBaseUrl}/support`,
  });
}

// EXAMPLE 3: Queue updated email when event details change
// Add this to your PATCH /:id handler (event update):

// Track what changed
const changedFields: string[] = [];
if (req.body.title && req.body.title !== existingEvent.title) changedFields.push('Title');
if (req.body.date && req.body.date !== existingEvent.date) changedFields.push('Date/Time');
if (req.body.location && req.body.location !== existingEvent.location) changedFields.push('Location');
if (req.body.description && req.body.description !== existingEvent.description) changedFields.push('Description');

// Queue email to all RSVPed users
if (changedFields.length > 0) {
  const rsvps = await prisma.eventRsvp.findMany({
    where: { event_id: event.id },
    include: { user: { select: { email: true, display_name: true } } },
  });

  await Promise.all(
    rsvps.map((rsvp) =>
      emailQueue.add('events.updated', {
        to: rsvp.user.email,
        to_name: rsvp.user.display_name,
        event_id: event.id,
        event_name: updatedEvent.title,
        event_start_date: updatedEvent.date.toISOString(),
        event_location_name: updatedEvent.location || undefined,
        event_city: undefined,
        event_state: undefined,
        update_summary: `${changedFields.length} field(s) updated`,
        changed_fields_text: changedFields.join(', '),
        view_event_url: `${appBaseUrl}/events/${event.id}`,
        manage_event_url: `${appBaseUrl}/events/${event.id}/edit`,
      })
    )
  );
}

// EXAMPLE 4: Queue canceled email when event is canceled
// Add this to your DELETE /:id or PATCH /:id/cancel handler:

// Get all RSVPs before canceling
const rsvps = await prisma.eventRsvp.findMany({
  where: { event_id: eventId },
  include: { user: { select: { email: true, display_name: true } } },
});

// Update event status
await prisma.event.update({
  where: { id: eventId },
  data: { status: 'canceled' },
});

// Queue cancellation emails
await Promise.all(
  rsvps.map((rsvp) =>
    emailQueue.add('events.canceled', {
      to: rsvp.user.email,
      to_name: rsvp.user.display_name,
      event_id: event.id,
      event_name: event.title,
      event_start_date: event.date.toISOString(),
      event_location_name: event.location || undefined,
      event_city: undefined,
      event_state: undefined,
      cancellation_reason: req.body.reason || 'This event has been canceled by the organizer.',
      contact_support_url: `${appBaseUrl}/support`,
      manage_event_url: `${appBaseUrl}/events`,
    })
  )
);

// ============================================================================
// FILE 4: server/src/lib/utils.ts (CREATE IF MISSING)
// ============================================================================

/**
 * Format date for email templates
 */
export function formatEventDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format time for email templates
 */
export function formatEventTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Format date and time combined
 */
export function formatEventDateTime(date: Date | string): string {
  return `${formatEventDate(date)} at ${formatEventTime(date)}`;
}

/**
 * Parse location into city/state (basic implementation)
 */
export function parseLocation(location?: string | null): { city?: string; state?: string } {
  if (!location) return {};
  
  // Simple regex for "City, ST" format
  const match = location.match(/([^,]+),\s*([A-Z]{2})/);
  if (match) {
    return { city: match[1].trim(), state: match[2].trim() };
  }
  
  return {};
}

// ============================================================================
// FILE 5: server/src/jobs/eventReminders.ts (CREATE NEW FILE)
// ============================================================================

import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../lib/queue.js';
import { debugLog } from '../lib/debugLog.js';

/**
 * Cron job to send event reminder emails
 * Runs every hour to check for events happening in 24 hours
 */
export async function sendEventReminders(): Promise<void> {
  debugLog('[cron] Running event reminder check');

  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Find approved events happening in 24-25 hours
  const upcomingEvents = await prisma.event.findMany({
    where: {
      approval_status: 'approved',
      status: { not: 'canceled' },
      date: {
        gte: in24Hours,
        lt: in25Hours,
      },
    },
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      latitude: true,
      longitude: true,
    },
  });

  debugLog(`[cron] Found ${upcomingEvents.length} events in the next 24 hours`);

  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '') || 'https://varsityhub.app';

  // For each event, queue reminder emails to all RSVPs
  for (const event of upcomingEvents) {
    const rsvps = await prisma.eventRsvp.findMany({
      where: { event_id: event.id },
      include: { user: { select: { email: true, display_name: true } } },
    });

    debugLog(`[cron] Queueing ${rsvps.length} reminder emails for event ${event.id}`);

    const directionsUrl =
      event.latitude && event.longitude
        ? `https://maps.google.com/?q=${event.latitude},${event.longitude}`
        : event.location
          ? `https://maps.google.com/?q=${encodeURIComponent(event.location)}`
          : appBaseUrl;

    await Promise.all(
      rsvps.map((rsvp) =>
        emailQueue.add('events.reminder', {
          to: rsvp.user.email,
          to_name: rsvp.user.display_name,
          event_id: event.id,
          event_name: event.title,
          event_start_date: event.date.toISOString(),
          event_location_name: event.location || undefined,
          event_city: undefined,
          event_state: undefined,
          check_in_url: `${appBaseUrl}/events/${event.id}/check-in`,
          add_to_calendar_url: `${appBaseUrl}/events/${event.id}/calendar`,
          get_directions_url: directionsUrl,
          preferences_url: `${appBaseUrl}/settings/notifications`,
        })
      )
    );
  }

  debugLog('[cron] Event reminder check complete');
}

// ============================================================================
// FILE 6: server/src/index.ts (ADD CRON REGISTRATION)
// ============================================================================

// Add this import at the top:
import { startEventReminders } from './cron/eventReminders.js';

// Add this AFTER the other cron jobs start:
// Around line 90, after startOvernightMonitoring(), etc.
startEventReminders();

// ============================================================================
// FILE 7: server/src/cron/eventReminders.ts (CRON WRAPPER)
// ============================================================================

import cron from 'node-cron';
import { sendEventReminders } from '../jobs/eventReminders.js';
import { debugLog } from '../lib/debugLog.js';

/**
 * Start event reminder cron job
 * Runs every hour at :00
 */
export function startEventReminders(): void {
  debugLog('[cron] Starting event reminder scheduler (hourly)');

  // Run every hour at :00
  cron.schedule('0 * * * *', async () => {
    try {
      await sendEventReminders();
    } catch (error) {
      console.error('[cron] Event reminder job failed:', error);
    }
  });

  debugLog('[cron] Event reminder scheduler started');
}

// ============================================================================
// DATABASE MIGRATION SQL
// ============================================================================

-- Add email tracking columns to events table (optional)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "submission_email_sent_at" TIMESTAMP;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "approval_email_sent_at" TIMESTAMP;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP;

-- Create index for reminder queries
CREATE INDEX IF NOT EXISTS "Event_date_approval_status_idx" 
  ON "Event"("date", "approval_status") 
  WHERE "approval_status" = 'approved' AND "status" != 'canceled';

-- Add event notification preferences to user preferences (optional)
-- This assumes your User.preferences is a JSONB column
-- Users can opt-out via the preferences_url in emails

/*
Example user preferences structure:
{
  "email_notifications": {
    "event_reminders": true,
    "event_updates": true,
    "event_cancellations": true
  }
}
*/

-- ============================================================================
-- ENVIRONMENT VARIABLES TO ADD
-- ============================================================================

/*
Add these to your Railway environment variables:

SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_EVENT_APPROVED_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_EVENT_DENIED_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_EVENT_REMINDER_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_EVENT_UPDATED_TEMPLATE_ID=d-xxxxxxxxxxxxx
SENDGRID_EVENT_CANCELED_TEMPLATE_ID=d-xxxxxxxxxxxxx
*/

// ============================================================================
// DEPLOYMENT CHECKLIST
// ============================================================================

/*
✓ 1. Email worker jobs added to server/src/workers/emailWorker.ts
☐ 2. Test routes added to server/src/routes/test-emails.ts
☐ 3. Route integration added to server/src/routes/events.ts
☐ 4. Utility functions added to server/src/lib/utils.ts
☐ 5. Event reminder job created at server/src/jobs/eventReminders.ts
☐ 6. Cron wrapper created at server/src/cron/eventReminders.ts
☐ 7. Cron registered in server/src/index.ts
☐ 8. Database migration SQL executed
☐ 9. Environment variables added to Railway
☐ 10. SendGrid templates created (6 total)
☐ 11. Test emails via /api/test-emails/event-all
☐ 12. Verify emails in SendGrid activity feed
*/
