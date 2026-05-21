import type { Response } from 'express';
import { isAdminEmail } from './adminEmails.js';
import { prisma } from './prisma.js';
import {
  consumeReviewToken,
  type ReviewTokenPayload,
} from './reviewTokens.js';
import type { AuthedRequest } from '../middleware/auth.js';

export type VerifiedAdminSession = {
  id: string;
  email: string | null;
};

type RenderHtmlResultPage = (
  title: string,
  message: string,
  success: boolean
) => string;

export async function resolveVerifiedAdminSession(
  req: AuthedRequest
): Promise<VerifiedAdminSession | null> {
  if (!req.user) return null;
  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, email_verified: true },
  });
  if (!me?.email_verified || !isAdminEmail(me.email)) return null;
  return { id: me.id, email: me.email };
}

export function sendAdminSignInRequiredHtml(
  res: Response,
  renderResultPage: RenderHtmlResultPage,
  action: string,
  subject: string
): void {
  res
    .status(401)
    .send(
      renderResultPage(
        'Admin Sign-In Required',
        `You must be signed in as a verified admin to ${action} ${subject}.`,
        false
      )
    );
}

export async function consumeReviewTokenOrRenderHtml(
  res: Response,
  token: string,
  payload: ReviewTokenPayload,
  renderResultPage: RenderHtmlResultPage,
  messages?: {
    alreadyUsed?: string;
    storeUnavailable?: string;
  }
): Promise<boolean> {
  const consumeResult = await consumeReviewToken(token, payload);
  if (consumeResult === 'already_used') {
    res
      .status(409)
      .send(
        renderResultPage(
          'Link Already Used',
          messages?.alreadyUsed || 'This review link has already been used.',
          false
        )
      );
    return false;
  }
  if (consumeResult === 'store_unavailable') {
    res
      .status(503)
      .send(
        renderResultPage(
          'Temporarily Unavailable',
          messages?.storeUnavailable ||
            'This review link cannot be completed right now. Please use the admin dashboard instead.',
          false
        )
      );
    return false;
  }
  return true;
}
