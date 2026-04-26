import type { PrismaClient } from '@prisma/client';
import { getAllAdminEmails } from './adminEmails.js';
import { sendEventPendingReviewEmail } from './email.js';
import { ORG_ADMIN_ROLES, TEAM_STAFF_ROLES } from './teamAuthorization.js';

export type EventReviewKind = 'event' | 'game';

export type EventReviewRecipient = {
  userId: string | null;
  email: string;
  displayName: string;
  source: 'team' | 'org' | 'admin_fallback';
};

function normalizeEmail(email: string | null | undefined): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function formatEventReviewNotes(params: {
  eventType?: string | null;
  eventDate?: Date | string | null;
  eventLocation?: string | null;
  notes?: string | null;
}): string {
  const parts: string[] = [];

  if (params.eventType) parts.push(`Type: ${params.eventType}`);

  if (params.eventDate) {
    const parsed = params.eventDate instanceof Date ? params.eventDate : new Date(params.eventDate);
    if (!Number.isNaN(parsed.getTime())) {
      parts.push(
        `Date: ${parsed.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}`
      );
      parts.push(
        `Time: ${parsed.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}`
      );
    }
  }

  if (params.eventLocation) parts.push(`Location: ${params.eventLocation}`);
  if (params.notes) parts.push(`Notes: ${params.notes}`);

  return parts.join('\n');
}

export async function getPendingEventReviewRecipients(
  prisma: PrismaClient,
  params: { teamId?: string | null }
): Promise<EventReviewRecipient[]> {
  const teamId = typeof params.teamId === 'string' && params.teamId.trim().length > 0
    ? params.teamId.trim()
    : null;

  if (!teamId) {
    return getAllAdminEmails().map((email) => ({
      userId: null,
      email,
      displayName: 'Admin',
      source: 'admin_fallback',
    }));
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, organization_id: true },
  });

  const [teamStaff, orgAdmins] = await Promise.all([
    prisma.teamMembership.findMany({
      where: {
        team_id: teamId,
        role: { in: [...TEAM_STAFF_ROLES] },
        status: 'active',
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            display_name: true,
          },
        },
      },
      take: 100,
    }),
    team?.organization_id
      ? prisma.organizationMembership.findMany({
          where: {
            organization_id: team.organization_id,
            role: { in: [...ORG_ADMIN_ROLES] },
            status: 'active',
          },
          select: {
            user: {
              select: {
                id: true,
                email: true,
                display_name: true,
              },
            },
          },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  const deduped = new Map<string, EventReviewRecipient>();

  for (const membership of teamStaff) {
    const email = normalizeEmail(membership.user?.email);
    if (!email) continue;
    deduped.set(email, {
      userId: membership.user?.id || null,
      email,
      displayName: membership.user?.display_name || 'Coach',
      source: 'team',
    });
  }

  for (const membership of orgAdmins) {
    const email = normalizeEmail(membership.user?.email);
    if (!email || deduped.has(email)) continue;
    deduped.set(email, {
      userId: membership.user?.id || null,
      email,
      displayName: membership.user?.display_name || 'Organization Admin',
      source: 'org',
    });
  }

  if (deduped.size > 0) {
    return [...deduped.values()];
  }

  return getAllAdminEmails().map((email) => ({
    userId: null,
    email,
    displayName: 'Admin',
    source: 'admin_fallback',
  }));
}

export async function notifyPendingEventReviewers(
  prisma: PrismaClient,
  params: {
    reviewId: string;
    reviewKind?: EventReviewKind;
    teamId?: string | null;
    requesterName?: string | null;
    requesterEmail?: string | null;
    eventTitle: string;
    eventType?: string | null;
    eventDate?: Date | string | null;
    eventLocation?: string | null;
    teamName?: string | null;
    notes?: string | null;
  }
): Promise<number> {
  const recipients = await getPendingEventReviewRecipients(prisma, {
    teamId: params.teamId,
  });

  if (recipients.length === 0) return 0;

  const reviewKind = params.reviewKind || 'event';
  const coachNotes = formatEventReviewNotes({
    eventType: params.eventType,
    eventDate: params.eventDate,
    eventLocation: params.eventLocation,
    notes: params.notes,
  });

  await Promise.all(
    recipients.map((recipient) =>
      sendEventPendingReviewEmail({
        to: recipient.email,
        reviewerName: recipient.displayName,
        requesterName: params.requesterName || 'VarsityHub User',
        requesterEmail: params.requesterEmail || '',
        eventTitle: params.eventTitle,
        eventType: params.eventType || undefined,
        teamName: params.teamName || undefined,
        reviewId: params.reviewId,
        reviewKind,
        coachNotes,
      }).catch((err) => {
        console.error(
          '[eventReviewNotifications] Failed sending event review email:',
          {
            reviewId: params.reviewId,
            reviewKind,
            to: recipient.email,
            error: (err as any)?.message || err,
          }
        );
      })
    )
  );

  return recipients.length;
}
