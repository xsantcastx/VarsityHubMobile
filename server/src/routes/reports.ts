/**
 * Content Reporting Endpoints
 *
 * Allows users to report specific content (posts, users, comments, messages, ads)
 * for moderation review.
 *
 * @module routes/reports
 */

import { Router } from 'express';
import { z } from 'zod';
import { debugLog } from '../lib/debugLog.js';
import { sendAbuseReportEmail } from '../lib/email.js';
import { autoEscalate } from '../lib/moderation.js';
import { prisma } from '../lib/prisma.js';
import { stripHtml } from '../lib/sanitizeHtml.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { reportLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const reportsRouter = Router();

// Valid report reasons
const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'nudity',
  'false_information',
  'impersonation',
  'self_harm',
  'illegal_activity',
  'copyright',
  'other',
] as const;

type ReportReason = (typeof REPORT_REASONS)[number];

// Valid content types that can be reported
const REPORTABLE_TYPES = [
  'post',
  'user',
  'comment',
  'message',
  'group_chat_message',
  'team',
  'ad',
] as const;
type ReportableType = (typeof REPORTABLE_TYPES)[number];

// Schema for creating a report
const createReportSchema = z.object({
  target_type: z.enum(REPORTABLE_TYPES),
  target_id: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(2000).optional(),
});

/**
 * POST /reports - Create a new content report
 *
 * Reports content for moderation review. Users can only report
 * the same content once per 24 hours to prevent spam.
 */
reportsRouter.post(
  '/',
  requireAuth as any,
  requireVerified as any,
  reportLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }

    const { target_type, target_id, reason, details } = parsed.data;

    // Validate that the target exists and capture context
    let targetExists = false;
    let targetContext: Record<string, any> = {};

    try {
      switch (target_type) {
        case 'post': {
          const post = await prisma.post.findUnique({
            where: { id: target_id },
            select: {
              id: true,
              author_id: true,
              content: true,
              media_url: true,
              created_at: true,
            },
          });
          if (post) {
            targetExists = true;
            targetContext = {
              post_author_id: post.author_id,
              content_preview: post.content?.substring(0, 200),
              has_media: !!post.media_url,
              created_at: post.created_at,
            };

            // Can't report own content
            if (post.author_id === req.user.id) {
              return res.status(400).json({ error: 'You cannot report your own content' });
            }
          }
          break;
        }
        case 'user': {
          const user = await prisma.user.findUnique({
            where: { id: target_id },
            select: {
              id: true,
              display_name: true,
              bio: true,
              created_at: true,
            },
          });
          if (user) {
            targetExists = true;
            targetContext = {
              display_name: user.display_name,
              bio_preview: user.bio?.substring(0, 200),
              created_at: user.created_at,
            };

            // Can't report yourself
            if (user.id === req.user.id) {
              return res.status(400).json({ error: 'You cannot report yourself' });
            }
          }
          break;
        }
        case 'comment': {
          const comment = await prisma.comment.findUnique({
            where: { id: target_id },
            select: {
              id: true,
              author_id: true,
              content: true,
              post_id: true,
              created_at: true,
            },
          });
          if (comment) {
            targetExists = true;
            targetContext = {
              comment_author_id: comment.author_id,
              content_preview: comment.content?.substring(0, 200),
              post_id: comment.post_id,
              created_at: comment.created_at,
            };

            // Can't report own content
            if (comment.author_id === req.user.id) {
              return res.status(400).json({ error: 'You cannot report your own content' });
            }
          }
          break;
        }
        case 'message': {
          const message = await prisma.message.findUnique({
            where: { id: target_id },
            select: {
              id: true,
              sender_id: true,
              recipient_id: true,
              content: true,
              created_at: true,
            },
          });
          if (message) {
            // Only recipient can report a message
            if (message.recipient_id !== req.user.id && message.sender_id !== req.user.id) {
              return res
                .status(403)
                .json({ error: 'You can only report messages in your conversations' });
            }

            // Can't report own messages
            if (message.sender_id === req.user.id) {
              return res.status(400).json({ error: 'You cannot report your own messages' });
            }

            targetExists = true;
            targetContext = {
              sender_id: message.sender_id,
              content_preview: message.content?.substring(0, 200),
              created_at: message.created_at,
            };
          }
          break;
        }
        case 'group_chat_message': {
          const gcm = await prisma.groupChatMessage.findUnique({
            where: { id: target_id },
            select: { id: true, chat_id: true, sender_id: true, content: true, created_at: true },
          });
          if (gcm) {
            // Only a member of the chat may report a message in it.
            const membership = await prisma.groupChatMember.findFirst({
              where: { chat_id: gcm.chat_id, user_id: req.user.id },
              select: { id: true },
            });
            if (!membership) {
              return res
                .status(403)
                .json({ error: 'You can only report messages in group chats you belong to' });
            }
            if (gcm.sender_id === req.user.id) {
              return res.status(400).json({ error: 'You cannot report your own messages' });
            }
            targetExists = true;
            targetContext = {
              sender_id: gcm.sender_id,
              content_preview: gcm.content?.substring(0, 200),
              created_at: gcm.created_at,
            };
          }
          break;
        }
        case 'team': {
          const team = await prisma.team.findUnique({
            where: { id: target_id },
            select: {
              id: true,
              name: true,
              description: true,
              created_at: true,
            },
          });
          if (team) {
            // Can't report a team you own (parity with other self-guards).
            const ownerRow = await prisma.teamMembership.findFirst({
              where: { team_id: target_id, user_id: req.user.id, role: 'owner', status: 'active' },
              select: { id: true },
            });
            if (ownerRow) {
              return res.status(400).json({ error: 'You cannot report your own team' });
            }
            targetExists = true;
            targetContext = {
              team_name: team.name,
              description_preview: team.description?.substring(0, 200),
              created_at: team.created_at,
            };
          }
          break;
        }
        case 'ad': {
          const ad = await prisma.ad.findUnique({
            where: { id: target_id },
            select: {
              id: true,
              user_id: true,
              business_name: true,
              description: true,
              banner_url: true,
              target_url: true,
              status: true,
              payment_status: true,
              created_at: true,
            },
          });
          if (ad) {
            targetExists = true;
            targetContext = {
              ad_owner_id: ad.user_id,
              business_name: ad.business_name,
              description_preview: ad.description?.substring(0, 200),
              banner_url: ad.banner_url,
              target_url: ad.target_url,
              status: ad.status,
              payment_status: ad.payment_status,
              created_at: ad.created_at,
            };

            if (ad.user_id && ad.user_id === req.user.id) {
              return res.status(400).json({ error: 'You cannot report your own ad' });
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error('[Reports] Failed to validate target:', error);
      return res.status(500).json({ error: 'Failed to validate report target' });
    }

    if (!targetExists) {
      return res.status(404).json({ error: `${target_type} not found` });
    }

    // Check for duplicate recent report (same user, same target, within 24 hours).
    // Encoded as `[type:id] Reason: ...` in the AbuseReport.subject column —
    // ContentReport schema doesn't exist yet (tracked debt). Use startsWith,
    // not contains: the marker is always at index 0 of the subject, so the
    // range scan is both more precise (no false-positive substring hits if a
    // future subject template contains brackets elsewhere) and cheaper than
    // a full-text contains scan.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dedupSubjectPrefix = `[${target_type}:${target_id}]`;

    const recentReports = await prisma.abuseReport.findMany({
      where: {
        reporter_id: req.user.id,
        created_at: { gte: twentyFourHoursAgo },
        subject: { startsWith: dedupSubjectPrefix },
      },
      take: 1,
    });

    if (recentReports.length > 0) {
      return res.status(409).json({
        error: 'Duplicate report',
        message: 'You have already reported this content recently',
      });
    }

    // Get reporter info
    const reporter = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { display_name: true, email: true },
    });

    // Create the report using existing AbuseReport model
    // Subject format: [type:id] Reason: reason_text
    // Message contains the details and context
    const report = await prisma.abuseReport.create({
      data: {
        reporter_id: req.user.id,
        reporter_name: reporter?.display_name || 'Unknown',
        reporter_email: reporter?.email || 'unknown@email.com',
        subject: `[${target_type}:${target_id}] ${reason.replace(/_/g, ' ')}`,
        message: JSON.stringify(
          {
            target_type,
            target_id,
            reason,
            details: details ? stripHtml(details) : null,
            context: targetContext,
            reported_at: new Date().toISOString(),
          },
          null,
          2
        ),
        status: 'pending',
      },
    });

    // Log report for moderation tracking
    if (process.env.NODE_ENV !== 'production') {
      debugLog(`[Reports] User ${req.user.id} reported ${target_type}:${target_id} for ${reason}`);
    }

    // Send admin notification email
    try {
      await sendAbuseReportEmail({
        to: (await import('../lib/adminEmails.js')).getPrimaryAdminEmail(),
        reporterName: reporter?.display_name || 'Unknown',
        reporterEmail: reporter?.email || 'unknown@email.com',
        reportedContentType: target_type,
        reportedContentId: target_id,
        reportReason: reason,
        reportDetails: details || undefined,
        contentContext: targetContext,
        reportId: report.id,
      });
    } catch (err) {
      console.error('[Reports] Failed to send admin notification email:', err);
      // Don't fail the report creation if email fails
    }

    // Auto-escalation: check if the reported user should receive a warning/strike/suspension
    let escalation: { action: string } | null = null;
    try {
      const targetUserId =
        target_type === 'user'
          ? target_id
          : (targetContext as any)?.post_author_id ||
            (targetContext as any)?.comment_author_id ||
            (targetContext as any)?.sender_id ||
            (targetContext as any)?.ad_owner_id ||
            null;
      if (targetUserId) {
        escalation = await autoEscalate(targetUserId);
      }
    } catch (err) {
      console.error('[Reports] Auto-escalation check failed:', err);
    }

    return res.status(201).json({
      ok: true,
      reportId: report.id,
      message: 'Report submitted successfully. Our team will review it.',
    });
  })
);

/**
 * GET /reports/reasons - Get available report reasons
 *
 * Returns the list of valid report reasons with descriptions.
 */
reportsRouter.get(
  '/reasons',
  requireAuth as any,
  asyncHandler(async (_req, res) => {
    const reasons = REPORT_REASONS.map(reason => ({
      value: reason,
      label: reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: getReasonDescription(reason),
    }));

    return res.json({ reasons });
  })
);

/**
 * GET /reports/my - Get user's submitted reports
 *
 * Returns the reports submitted by the current user.
 */
reportsRouter.get(
  '/my',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const reports = await prisma.abuseReport.findMany({
      where: {
        reporter_id: req.user.id,
        // Only get content reports (have the [type:id] format)
        subject: { contains: '[' },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        subject: true,
        status: true,
        created_at: true,
        reviewed_at: true,
      },
    });

    // Parse the reports to extract target info
    const parsed = reports.map(r => {
      const match = r.subject.match(/\[(\w+):([^\]]+)\]/);
      return {
        id: r.id,
        target_type: match?.[1] || 'unknown',
        target_id: match?.[2] || 'unknown',
        reason: r.subject.replace(/\[.*?\]\s*/, ''),
        status: r.status,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
      };
    });

    return res.json({ reports: parsed });
  })
);

/**
 * Helper to get description for a report reason
 */
function getReasonDescription(reason: ReportReason): string {
  const descriptions: Record<ReportReason, string> = {
    spam: 'Unwanted commercial content or repetitive messages',
    harassment: 'Bullying, intimidation, or targeted abuse',
    hate_speech:
      'Attacks based on race, ethnicity, religion, gender, or other protected characteristics',
    violence: 'Threats of violence or graphic content',
    nudity: 'Sexual or nude content',
    false_information: 'Misleading or false information',
    impersonation: 'Pretending to be someone else',
    self_harm: 'Content promoting self-harm or suicide',
    illegal_activity: 'Content involving illegal activities',
    copyright: 'Infringement of intellectual property rights',
    other: 'Other policy violation not listed above',
  };
  return descriptions[reason];
}

export default reportsRouter;
