/**
 * Test endpoints for push notifications and geofencing
 * Remove this file in production or protect with admin auth
 */

import { Router } from 'express';
import { sendPasswordResetEmail } from '../lib/email.js';
import { calculateDistance, isWithinGeofence, verifyEventPostingPermission } from '../lib/geofencing.js';
import { notifyNewFollower, notifyNewMessage, notifyPostInteraction, sendPushNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import * as Sentry from '../lib/sentry.js';
import * as Twilio from '../lib/twilio.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const testNotificationsRouter = Router();

// Production integration test endpoints (temporary - remove after verification)
testNotificationsRouter.get('/email', async (req, res) => {
  try {
    const testEmail = process.env.TEST_EMAIL || 'customerservice@varsityhub.app';
    await sendPasswordResetEmail(testEmail, 'test-reset-token-12345');
    res.json({ 
      success: true, 
      message: `Test email sent to ${testEmail}. Check inbox and verify SPF/DKIM headers.`,
      instructions: 'View raw email headers and confirm: spf=pass, dkim=pass'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

testNotificationsRouter.get('/sms', async (req, res) => {
  try {
    const testPhone = process.env.TEST_PHONE;
    if (!testPhone) {
      return res.status(400).json({ 
        error: 'Set TEST_PHONE env var with your phone number (e.g., +15551234567)' 
      });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const success = await Twilio.sendSmsVerificationCode(testPhone, code);
    if (!success) {
      return res.status(500).json({ error: 'Twilio not configured or SMS failed' });
    }
    res.json({ 
      success: true, 
      message: `Test SMS sent to ${testPhone}. Check device and Twilio logs.`,
      code
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

testNotificationsRouter.get('/sentry', async (req, res) => {
  try {
    Sentry.captureException('Test error for Sentry verification - safe to ignore');
    res.json({ 
      success: true, 
      message: 'Test event and exception sent to Sentry. Check dashboard.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only helper to inspect verification state for a specific user
 * Usage (requires admin JWT):
 *   curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
 *     "https://api.../test-notifications/verification-status?email=test@example.com"
 */
// Phone verification endpoint disabled - schema fields deprecated
/* 
testNotificationsRouter.get(
  '/verification-status',
  requireAuth as any,
  requireAdmin as any,
  async (req: AuthedRequest, res) => {
    try {
      const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : undefined;
      const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : undefined;

      if (!email && !userId) {
        return res.status(400).json({
          error: 'Provide email or userId query parameter',
          example: '/test-notifications/verification-status?email=customerservice@varsityhub.app',
        });
      }

      const user = await prisma.user.findUnique({
        where: email ? { email } : { id: userId! },
        select: {
          id: true,
          email: true,
          email_verified: true,
          created_at: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified,
          created_at: user.created_at,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);
*/

// Test: Send a basic push notification to yourself
testNotificationsRouter.post('/test/push', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    await sendPushNotification(
      req.user!.id,
      'Test Notification 🎉',
      'If you see this, push notifications are working!',
      { type: 'test', timestamp: new Date().toISOString() }
    );
    
    res.json({ 
      success: true, 
      message: 'Test notification sent! Check your device.' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to send notification', 
      details: error.message 
    });
  }
});

// Test: Check if user has a valid push token
testNotificationsRouter.get('/test/check-token', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        email: true,
        display_name: true,
        preferences: true,
      },
    });

    const prefs = user?.preferences as any;
    const token = prefs?.push_token;
    const notificationsEnabled = prefs?.notifications_enabled !== false;

    res.json({
      has_token: !!token,
      token_preview: token ? `${token.substring(0, 20)}...` : null,
      notifications_enabled: notificationsEnabled,
      status: token ? '✅ Ready to receive notifications' : '❌ No push token registered',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test: Simulate different notification types
testNotificationsRouter.post('/test/simulate/:type', requireAuth as any, async (req: AuthedRequest, res) => {
  const { type } = req.params;
  const userId = req.user!.id;

  try {
    switch (type) {
      case 'message':
        await notifyNewMessage(userId, userId, 'Test User', 'This is a test direct message!');
        break;
      
      case 'like':
        await notifyPostInteraction(userId, 'like', userId, 'Test User', 'post_test_123');
        break;
      
      case 'comment':
        await notifyPostInteraction(userId, 'comment', userId, 'Test User', 'post_test_123');
        break;
      
      case 'follow':
        await notifyNewFollower(userId, userId, 'Test User');
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid type. Use: message, like, comment, or follow' });
    }

    res.json({ 
      success: true, 
      message: `Sent ${type} notification! Check your device.` 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test: Check geofencing for an event
testNotificationsRouter.post('/test/geofence', requireAuth as any, async (req: AuthedRequest, res) => {
  const { event_id, lat, lng } = req.body;

  if (!event_id || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ 
      error: 'Provide event_id, lat, and lng',
      example: {
        event_id: 'evt_123',
        lat: 34.0522,
        lng: -118.2437
      }
    });
  }

  try {
    const result = await verifyEventPostingPermission(event_id, req.user!.id, lat, lng);
    
    // Get event details for context
    const event = await prisma.event.findUnique({
      where: { id: event_id },
      select: { title: true, location: true, latitude: true, longitude: true, date: true }
    });

    res.json({
      allowed: result.allowed,
      reason: result.reason,
      distance_miles: result.distance,
      event: {
        title: event?.title,
        location: event?.location,
        event_coords: { lat: event?.latitude, lng: event?.longitude },
        your_coords: { lat, lng },
      },
      posting_window_open: event?.date ? new Date() >= new Date(new Date(event.date).getTime() - 24 * 60 * 60 * 1000) : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test: Calculate distance between two points
testNotificationsRouter.post('/test/distance', (req, res) => {
  const { lat1, lng1, lat2, lng2 } = req.body;

  if (typeof lat1 !== 'number' || typeof lng1 !== 'number' || 
      typeof lat2 !== 'number' || typeof lng2 !== 'number') {
    return res.status(400).json({ 
      error: 'Provide lat1, lng1, lat2, lng2 as numbers',
      example: {
        lat1: 34.0522,
        lng1: -118.2437,
        lat2: 34.0622,
        lng2: -118.2537
      }
    });
  }

  const distanceMiles = calculateDistance(lat1, lng1, lat2, lng2, 'miles');
  const distanceKm = calculateDistance(lat1, lng1, lat2, lng2, 'km');
  const withinHalfMile = isWithinGeofence(lat1, lng1, lat2, lng2, 0.5);

  res.json({
    distance_miles: distanceMiles.toFixed(2),
    distance_km: distanceKm.toFixed(2),
    within_geofence: withinHalfMile,
    geofence_radius: '0.5 miles',
  });
});

// Test: Get all upcoming games that would trigger notifications
testNotificationsRouter.get('/test/upcoming-games', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const now = new Date();
    const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    const [games12h, games1h] = await Promise.all([
      prisma.event.findMany({
        where: {
          date: {
            gte: new Date(twelveHoursFromNow.getTime() - 5 * 60 * 1000),
            lte: new Date(twelveHoursFromNow.getTime() + 5 * 60 * 1000),
          },
          status: 'active',
          rsvps: {
            some: {
              user_id: req.user!.id
            }
          }
        },
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
        }
      }),
      prisma.event.findMany({
        where: {
          date: {
            gte: new Date(oneHourFromNow.getTime() - 5 * 60 * 1000),
            lte: new Date(oneHourFromNow.getTime() + 5 * 60 * 1000),
          },
          status: 'active',
          rsvps: {
            some: {
              user_id: req.user!.id
            }
          }
        },
        select: {
          id: true,
          title: true,
          date: true,
          location: true,
        }
      })
    ]);

    res.json({
      current_time: now.toISOString(),
      games_in_12_hours: games12h.length,
      games_in_1_hour: games1h.length,
      would_receive_12h_reminder: games12h,
      would_receive_1h_reminder: games1h,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
