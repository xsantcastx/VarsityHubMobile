export type LinkedProvidersSnapshot = {
  password: boolean;
  google: boolean;
  apple: boolean;
};

type AuthStateLike = {
  has_password?: boolean | null;
  google_id?: string | null;
  apple_id?: string | null;
  linked_providers?: {
    password?: boolean | null;
    google?: boolean | null;
    apple?: boolean | null;
  } | null;
  approval_status?: string | null;
};

export function getLinkedProvidersSnapshot(
  source: AuthStateLike | null | undefined
): LinkedProvidersSnapshot {
  const linked = source?.linked_providers;
  if (linked) {
    return {
      password: linked.password === true,
      google: linked.google === true,
      apple: linked.apple === true,
    };
  }

  const hasOauthProvider = Boolean(source?.google_id || source?.apple_id);
  return {
    password:
      typeof source?.has_password === 'boolean' ? source.has_password : !hasOauthProvider,
    google: Boolean(source?.google_id),
    apple: Boolean(source?.apple_id),
  };
}

export function isApprovedCoach(source: AuthStateLike | null | undefined): boolean {
  return String(source?.approval_status || '').toUpperCase() === 'APPROVED';
}
