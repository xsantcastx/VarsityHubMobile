type AccountDeletionUserLike = {
  password_hash?: string | null;
  google_id?: string | null;
  apple_id?: string | null;
};

type AccountDeletionPayloadLike = {
  password?: string | null;
  delete_confirmation?: string | null;
};

type AccountDeletionRequirementResult =
  | {
      ok: true;
      requiresPassword: boolean;
      normalizedDeleteConfirmation: 'DELETE';
    }
  | {
      ok: false;
      status: number;
      body: {
        error: string;
        message: string;
      };
    };

function getOAuthProviderLabel(user: AccountDeletionUserLike): string {
  if (user.google_id) return 'Google';
  if (user.apple_id) return 'Apple';
  return 'your social account';
}

export function getAccountDeletionConfirmationRequirements(
  user: AccountDeletionUserLike,
  payload: AccountDeletionPayloadLike
): AccountDeletionRequirementResult {
  const normalizedDeleteConfirmation = String(payload.delete_confirmation || '')
    .trim()
    .toUpperCase();
  // OAuth users (Google/Apple) do not need to provide a password even if
  // they also have a password_hash (hybrid account). They authenticated via
  // their OAuth provider, which is sufficient re-auth for account deletion.
  const hasOAuthProvider = Boolean(user.google_id || user.apple_id);
  const requiresPassword = Boolean(user.password_hash) && !hasOAuthProvider;

  if (normalizedDeleteConfirmation !== 'DELETE') {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'DELETE_CONFIRMATION_REQUIRED',
        message: requiresPassword
          ? 'Type DELETE and provide your password to delete your account.'
          : `Your account uses ${getOAuthProviderLabel(user)} sign-in. Type DELETE to confirm account deletion.`,
      },
    };
  }

  if (requiresPassword && !String(payload.password || '').trim()) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'PASSWORD_REQUIRED',
        message: 'Provide your password to delete your account.',
      },
    };
  }

  return {
    ok: true,
    requiresPassword,
    normalizedDeleteConfirmation: 'DELETE',
  };
}
