import { Router } from 'express';
import { debugLog } from '../lib/debugLog.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const adsAnalyticsRouter = Router();

/**
 * GET /ads/:id/analytics
 *
 * Returns comprehensive analytics for an ad (owner-only).
 * Includes: impressions, clicks, time spent on target website, date distribution.
 *
 * Response:
 * {
 *   id: string;
 *   business_name?: string;
 *   target_zip_code?: string;
 *   status: string;
 *   payment_status: string;
 *   created_at: ISO date string;
 *   total_impressions: number; // count of reservations
 *   total_clicks: number; // count of clicks
 *   click_rate: number; // percentage: (clicks / impressions) * 100
 *   avg_session_duration: number; // average seconds spent on target site
 *   total_time_spent: number; // total seconds across all sessions
 *   reservation_dates: { date: string; count: number }[];
 *   clicks_by_date: { date: string; clicks: number; avg_duration: number }[];
 * }
 */
adsAnalyticsRouter.get('/:id/analytics', requireVerified as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);

  debugLog('[ads-analytics] GET /:id/analytics', { id, userId: req.user?.id });

  try {
    // Fetch ad with reservations and clicks
    const ad = await prisma.ad.findUnique({
      where: { id },
      include: {
        reservations: {
          select: { date: true },
          orderBy: { date: 'asc' },
        },
        clicks: {
          select: { clicked_at: true, session_duration: true },
          orderBy: { clicked_at: 'desc' },
        },
      },
    });

    if (!ad) {
      debugLog('[ads-analytics] Ad not found', { id });
      return res.status(404).json({ error: 'Ad not found' });
    }

    // SECURITY: Enforce ownership — only the ad owner can view analytics
    if (ad.user_id !== req.user?.id) {
      debugLog('[ads-analytics] Unauthorized access', { id, adUserId: ad.user_id, userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden: You do not own this ad' });
    }

    // ========================
    // IMPRESSIONS (reservations)
    // ========================
    const dateHistogram = new Map<string, number>();
    for (const reservation of ad.reservations) {
      const dateStr = reservation.date.toISOString().split('T')[0]; // yyyy-MM-dd
      dateHistogram.set(dateStr, (dateHistogram.get(dateStr) || 0) + 1);
    }

    const reservationDates = Array.from(dateHistogram.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ========================
    // CLICKS & TIME SPENT
    // ========================
    const totalClicks = ad.clicks.length;
    const totalImpressions = ad.reservations.length;
    const clickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    // Total and average time spent
    const totalTimeSpent = ad.clicks.reduce((sum, click) => sum + (click.session_duration || 0), 0);
    const avgSessionDuration = totalClicks > 0 ? Math.round(totalTimeSpent / totalClicks) : 0;

    // Build clicks by date histogram
    const clicksByDateMap = new Map<string, { clicks: number; durations: number[] }>();
    for (const click of ad.clicks) {
      const dateStr = click.clicked_at.toISOString().split('T')[0]; // yyyy-MM-dd
      const existing = clicksByDateMap.get(dateStr) || { clicks: 0, durations: [] };
      existing.clicks += 1;
      existing.durations.push(click.session_duration || 0);
      clicksByDateMap.set(dateStr, existing);
    }

    const clicksByDate = Array.from(clicksByDateMap.entries())
      .map(([date, data]) => ({
        date,
        clicks: data.clicks,
        avg_duration: Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length),
      }))
      .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first

    const response = {
      id: ad.id,
      business_name: ad.business_name,
      target_zip_code: ad.target_zip_code,
      status: ad.status,
      payment_status: ad.payment_status,
      created_at: ad.created_at.toISOString(),
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      click_rate: parseFloat(clickRate.toFixed(2)),
      avg_session_duration: avgSessionDuration,
      total_time_spent: totalTimeSpent,
      reservation_dates: reservationDates,
      clicks_by_date: clicksByDate,
    };

    debugLog('[ads-analytics] Analytics retrieved', {
      id,
      totalImpressions,
      totalClicks,
      clickRate: clickRate.toFixed(2),
      avgSessionDuration,
    });

    return res.json(response);
  } catch (error) {
    console.error('[ads-analytics] Error fetching analytics', { id, error });
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * POST /ads/:id/click
 *
 * Record a click event on an ad with optional session duration.
 * Called when user clicks the ad link and returns from the target website.
 *
 * Body:
 * {
 *   session_duration?: number; // seconds spent on target site
 *   user_agent?: string;
 * }
 *
 * Response: { success: true }
 */
adsAnalyticsRouter.post('/:id/click', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const { session_duration = 0, user_agent } = req.body || {};

  debugLog('[ads-analytics] POST /:id/click', { id, sessionDuration: session_duration });

  try {
    // Verify ad exists
    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Record the click
    await prisma.adClick.create({
      data: {
        ad_id: id,
        session_duration: Math.max(0, parseInt(session_duration) || 0), // Ensure non-negative integer
        user_agent: user_agent ? String(user_agent).slice(0, 255) : null, // Limit length
      },
    });

    debugLog('[ads-analytics] Click recorded', { id });
    return res.json({ success: true });
  } catch (error) {
    console.error('[ads-analytics] Error recording click', { id, error });
    return res.status(500).json({ error: 'Failed to record click' });
  }
});

