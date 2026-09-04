import { Router } from 'express';
import escapeHtml from 'escape-html';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { isGamePubliclyVisible } from '../lib/gameApproval.js';
import { isAllowedMediaUrl } from '../lib/mediaHosts.js';

/**
 * Open Graph link-preview pages for event/game share links.
 *
 * Why this exists: varsityhub.app is a STATIC Expo web export (one
 * index.html for every route — see vercel.json), so it can never serve
 * per-event og:image/og:title. Vercel rewrites crawler user-agents (see
 * vercel.json `rewrites`) for /events/:id and /games/:id to these routes;
 * everyone else still gets the SPA. Public and unauthenticated — but only
 * ever reveals data that is ALREADY publicly visible (approved games/events),
 * matching the same boundary GET /games and GET /events already enforce.
 */

export const ogRouter = Router();

const CANONICAL_APP_BASE_URL = process.env.APP_BASE_URL || 'https://www.varsityhub.app';
const DEFAULT_OG_IMAGE_URL =
  process.env.DEFAULT_OG_IMAGE_URL ||
  'https://res.cloudinary.com/dxb5oq4fs/image/upload/v1765655742/6C37232F-74BC-4486-95A1-7EE208A63D06_aj2j8k.png';

function firstAllowedImageUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && isAllowedMediaUrl(candidate)) return candidate;
  }
  return null;
}

async function representativePostImageUrl(where: any): Promise<string | null> {
  const post = await prisma.post.findFirst({
    where: {
      ...where,
      deleted_at: null,
      media_url: { not: null },
    },
    select: { media_url: true, poster_url: true },
    orderBy: [{ upvotes_count: 'desc' }, { created_at: 'desc' }],
  });
  return firstAllowedImageUrl(post?.poster_url, post?.media_url);
}

function genericOgPage(canonicalUrl: string): string {
  const safeUrl = escapeHtml(canonicalUrl);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${safeUrl}">
<meta property="og:title" content="VarsityHub">
<meta property="og:description" content="Follow youth and amateur sports on VarsityHub.">
<meta property="og:url" content="${safeUrl}">
<meta name="twitter:card" content="summary">
<title>VarsityHub</title>
</head>
<body>
<p>Redirecting to <a href="${safeUrl}">VarsityHub</a>...</p>
</body>
</html>`;
}

function ogPage(params: {
  title: string;
  description: string;
  imageUrl: string | null;
  canonicalUrl: string;
}): string {
  const safeTitle = escapeHtml(params.title);
  const safeDescription = escapeHtml(params.description);
  const safeUrl = escapeHtml(params.canonicalUrl);
  const imageTag = params.imageUrl
    ? `<meta property="og:image" content="${escapeHtml(params.imageUrl)}">\n<meta name="twitter:image" content="${escapeHtml(params.imageUrl)}">`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${safeUrl}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeUrl}">
<meta property="og:type" content="website">
${imageTag}
<meta name="twitter:card" content="${params.imageUrl ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<title>${safeTitle}</title>
</head>
<body>
<p><a href="${safeUrl}">${safeTitle}</a></p>
</body>
</html>`;
}

function formatDateLocation(date: Date | null, location: string | null): string {
  const parts: string[] = [];
  if (date) {
    parts.push(
      date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    );
  }
  if (location) parts.push(location);
  return parts.length ? parts.join(' · ') : 'Follow this event on VarsityHub.';
}

ogRouter.get(
  '/games/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const canonicalUrl = `${CANONICAL_APP_BASE_URL}/games/${encodeURIComponent(id)}`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');

    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        title: true,
        date: true,
        location: true,
        banner_url: true,
        cover_image_url: true,
        approval_status: true,
        opponent_approval_status: true,
      },
    });

    // Only ever reveal data GET /games already treats as public — no leaking
    // pending/rejected games, nor upcoming games whose opponent hasn't consented
    // (or declined), through this side door.
    if (!game || !isGamePubliclyVisible(game)) {
      return res.send(genericOgPage(canonicalUrl));
    }
    const imageUrl =
      firstAllowedImageUrl(game.banner_url, game.cover_image_url) ||
      (await representativePostImageUrl({ game_id: id })) ||
      DEFAULT_OG_IMAGE_URL;

    return res.send(
      ogPage({
        title: `${game.title} — VarsityHub`,
        description: formatDateLocation(game.date, game.location),
        imageUrl,
        canonicalUrl,
      })
    );
  })
);

ogRouter.get(
  '/events/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const canonicalUrl = `${CANONICAL_APP_BASE_URL}/events/${encodeURIComponent(id)}`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');

    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        title: true,
        date: true,
        location: true,
        banner_url: true,
        approval_status: true,
        status: true,
        game: {
          select: {
            banner_url: true,
            cover_image_url: true,
            approval_status: true,
            opponent_approval_status: true,
            date: true,
            id: true,
          },
        },
      },
    });

    // Same public-only boundary as GET /events — pending/rejected events never
    // surface here. A game-backed event also inherits the game's opponent-consent
    // gate: an upcoming fixture whose opponent is pending/declined stays private.
    const eventPublic =
      !!event && event.approval_status === 'approved' && event.status === 'approved';
    const gamePublic = !event?.game || isGamePubliclyVisible(event.game);
    if (!eventPublic || !gamePublic) {
      return res.send(genericOgPage(canonicalUrl));
    }
    const imageUrl =
      firstAllowedImageUrl(event.banner_url, event.game?.banner_url, event.game?.cover_image_url) ||
      (await representativePostImageUrl({
        OR: [{ event_id: id }, ...(event.game?.id ? [{ game_id: event.game.id }] : [])],
      })) ||
      DEFAULT_OG_IMAGE_URL;

    return res.send(
      ogPage({
        title: `${event.title} — VarsityHub`,
        description: formatDateLocation(event.date, event.location),
        imageUrl,
        canonicalUrl,
      })
    );
  })
);
