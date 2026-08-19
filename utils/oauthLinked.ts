export interface OAuthLinkedUserLike {
  google_id?: string | null;
  apple_id?: string | null;
  linked_providers?: { google?: boolean; apple?: boolean } | null;
}

/**
 * True when the account is linked to Google or Apple.
 *
 * OAuth accounts are verified at the identity provider, so the server marks
 * them `email_verified` at creation and re-heals any stragglers via
 * `ensureOAuthUserVerified` (server/src/lib/oauthVerification.ts) on `/me`,
 * `/feed`, payments, and `requireVerified`. No email verification code is ever
 * sent for an OAuth signup.
 *
 * The client MUST therefore never route an OAuth-linked user to the 6-digit
 * email-verification screen: a stale or racing `email_verified === false` read
 * (e.g. the 60s `/me` cache served before the self-heal runs) would strand them
 * on a code screen where no code can ever arrive. Mirrors the server helper of
 * the same name (server/src/lib/oauthVerification.ts).
 */
export function isOAuthLinkedUser(user: OAuthLinkedUserLike | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    user.google_id || user.apple_id || user.linked_providers?.google || user.linked_providers?.apple
  );
}
