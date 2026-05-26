export type LinkedProvidersSnapshot = {
  password: boolean;
  google: boolean;
  apple: boolean;
};

type AuthCheckFn<T> =
  | ((options?: {
      email?: string;
      pendingVerification?: boolean;
      replaceSession?: boolean;
      skipSubscriptionRefresh?: boolean;
      forceRefresh?: boolean;
    }) => Promise<T | null | undefined>)
  | undefined;

type AuthStateLike = {
  has_password?: boolean | null;
  google_id?: string | null;
  apple_id?: string | null;
  role?: string | null;
  onboarding_completed?: boolean | null;
  organization_id?: string | null;
  proceeding_as_fan?: boolean | null;
  coach_agreement_accepted_at?: string | null;
  linked_providers?: {
    password?: boolean | null;
    google?: boolean | null;
    apple?: boolean | null;
  } | null;
  approval_status?: string | null;
  preferences?: Record<string, unknown> | null;
};

function readPreferences(source: AuthStateLike | null | undefined): Record<string, unknown> {
  return source?.preferences && typeof source.preferences === 'object' ? source.preferences : {};
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
    password: typeof source?.has_password === 'boolean' ? source.has_password : !hasOauthProvider,
    google: Boolean(source?.google_id),
    apple: Boolean(source?.apple_id),
  };
}

export function getCanonicalRole(source: AuthStateLike | null | undefined): string | null {
  const preferences = readPreferences(source);
  return normalizeString(source?.role) ?? normalizeString(preferences.role);
}

export function isOnboardingCompleteSnapshot(source: AuthStateLike | null | undefined): boolean {
  if (typeof source?.onboarding_completed === 'boolean') {
    return source.onboarding_completed;
  }
  const preferences = readPreferences(source);
  return preferences.onboarding_completed === true;
}

export function getCanonicalOrganizationId(
  source: AuthStateLike | null | undefined
): string | null {
  const topLevel = normalizeString(source?.organization_id);
  if (topLevel) return topLevel;
  const preferences = readPreferences(source);
  return normalizeString(preferences.organization_id);
}

export function isProceedingAsFanSnapshot(source: AuthStateLike | null | undefined): boolean {
  if (typeof source?.proceeding_as_fan === 'boolean') {
    return source.proceeding_as_fan;
  }
  const preferences = readPreferences(source);
  return preferences.proceeding_as_fan === true;
}

export function hasAcceptedCoachAgreement(source: AuthStateLike | null | undefined): boolean {
  if (normalizeString(source?.coach_agreement_accepted_at)) return true;
  const preferences = readPreferences(source);
  return Boolean(normalizeString(preferences.coach_agreement_accepted_at));
}

export function isApprovedCoach(source: AuthStateLike | null | undefined): boolean {
  const role = String(getCanonicalRole(source) || '')
    .trim()
    .toLowerCase();
  return role === 'coach' && String(source?.approval_status || '').toUpperCase() === 'APPROVED';
}

/**
 * Reuse the current auth snapshot when the caller already has one. Fall back
 * to AuthProvider.checkAuth() only when local state is absent, so feature
 * screens do not each invent their own `/me` refresh policy.
 */
export async function getAuthSnapshot<T>(
  checkAuth: AuthCheckFn<T>,
  currentUser: T | null | undefined
): Promise<T | null> {
  if (currentUser != null) {
    return currentUser;
  }
  if (typeof checkAuth !== 'function') {
    return null;
  }
  return (await checkAuth()) ?? null;
}

/**
 * Auth-critical screens should prefer an AuthProvider-driven refresh before
 * falling back to any local snapshot.
 */
export async function getFreshAuthSnapshot<T>(
  checkAuth: AuthCheckFn<T>,
  currentUser: T | null | undefined
): Promise<T | null> {
  if (typeof checkAuth === 'function') {
    const fresh = await checkAuth({ skipSubscriptionRefresh: true, forceRefresh: true });
    if (fresh != null) {
      return fresh;
    }
  }
  return currentUser ?? null;
}
