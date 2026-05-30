type MaybeRecord = Record<string, any> | null;

export type CanonicalUserRole = 'fan' | 'coach';

export type UserAuthStateSource = {
  role?: CanonicalUserRole | string | null;
  approval_status?: string | null;
  onboarding_completed?: boolean | null;
  organization_id?: string | null;
  proceeding_as_fan?: boolean | null;
  coach_agreement_accepted_at?: Date | string | null;
  coach_agreement_version?: number | null;
  preferences?: unknown;
};

export type UserAuthStatePatch = {
  role?: CanonicalUserRole | null;
  onboarding_completed?: boolean | null;
  organization_id?: string | null;
  proceeding_as_fan?: boolean | null;
  coach_agreement_accepted_at?: Date | string | null;
  coach_agreement_version?: number | null;
};

export function getPreferencesObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, any>) };
  }
  return {};
}

function normalizeRole(raw: unknown): CanonicalUserRole | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === 'coach') return 'coach';
  if (value === 'fan' || value === 'supporter') return 'fan';
  if (
    value.includes('coach') ||
    value.includes('manager') ||
    value.includes('staff') ||
    value.includes('owner') ||
    value.includes('director') ||
    value.includes('admin')
  ) {
    return 'coach';
  }
  return 'fan';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toPreferenceDateString(value: Date | string | null | undefined): string | undefined {
  if (value === null) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

export function getCanonicalUserRole(source: UserAuthStateSource | null | undefined): CanonicalUserRole {
  const fromColumn = normalizeRole(source?.role);
  if (fromColumn) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  return normalizeRole(prefs.role) ?? 'fan';
}

export function isUserOnboardingComplete(source: UserAuthStateSource | null | undefined): boolean {
  const fromColumn = asNullableBoolean(source?.onboarding_completed);
  if (fromColumn !== null) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  return prefs.onboarding_completed === true;
}

export function getCanonicalOrganizationId(source: UserAuthStateSource | null | undefined): string | null {
  const fromColumn = asNullableString(source?.organization_id);
  if (fromColumn) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  return asNullableString(prefs.organization_id);
}

export function isProceedingAsFan(source: UserAuthStateSource | null | undefined): boolean {
  const fromColumn = asNullableBoolean(source?.proceeding_as_fan);
  if (fromColumn !== null) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  return prefs.proceeding_as_fan === true;
}

export function hasCoachFanModeAccess(
  source: UserAuthStateSource | null | undefined,
): boolean {
  const role = getCanonicalUserRole(source);
  if (role !== 'coach') return false;

  const approvalStatus = typeof source?.approval_status === 'string'
    ? source.approval_status.trim().toUpperCase()
    : '';

  return (approvalStatus === 'PENDING' || approvalStatus === 'REJECTED') && isProceedingAsFan(source);
}

export function getCoachAgreementAcceptedAt(
  source: UserAuthStateSource | null | undefined,
): Date | string | null {
  const fromColumn = source?.coach_agreement_accepted_at;
  if (fromColumn instanceof Date || typeof fromColumn === 'string') return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  const fallback = prefs.coach_agreement_accepted_at;
  return fallback instanceof Date || typeof fallback === 'string' ? fallback : null;
}

export function getCoachAgreementVersion(source: UserAuthStateSource | null | undefined): number | null {
  const fromColumn = asNullableNumber(source?.coach_agreement_version);
  if (fromColumn !== null) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  const fromPrefs = asNullableNumber(prefs.coach_agreement_version);
  if (fromPrefs !== null) return fromPrefs;

  // Backward compatibility: older approved coaches could have an acceptance
  // timestamp persisted before version stamping was introduced. Treat that as
  // version 1 so server-side route gates stay aligned with the client-side
  // role checks and migrated users don't get blocked from coach tools.
  return getCoachAgreementAcceptedAt(source) ? 1 : null;
}

export function mergeAuthStateIntoPreferences(
  currentPreferences: unknown,
  patch: UserAuthStatePatch,
): Record<string, any> {
  const next = getPreferencesObject(currentPreferences);

  if (patch.role !== undefined) {
    if (patch.role === null) delete next.role;
    else next.role = patch.role;
  }
  if (patch.onboarding_completed !== undefined) {
    if (patch.onboarding_completed === null) delete next.onboarding_completed;
    else next.onboarding_completed = patch.onboarding_completed;
  }
  if (patch.organization_id !== undefined) {
    if (patch.organization_id === null || patch.organization_id === '') delete next.organization_id;
    else next.organization_id = patch.organization_id;
  }
  if (patch.proceeding_as_fan !== undefined) {
    if (patch.proceeding_as_fan === null) delete next.proceeding_as_fan;
    else next.proceeding_as_fan = patch.proceeding_as_fan;
  }
  if (patch.coach_agreement_accepted_at !== undefined) {
    const value = toPreferenceDateString(patch.coach_agreement_accepted_at);
    if (!value) delete next.coach_agreement_accepted_at;
    else next.coach_agreement_accepted_at = value;
  }
  if (patch.coach_agreement_version !== undefined) {
    if (patch.coach_agreement_version === null) delete next.coach_agreement_version;
    else next.coach_agreement_version = patch.coach_agreement_version;
  }

  return next;
}

export function buildAuthStateColumns(patch: UserAuthStatePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (patch.role !== undefined && patch.role !== null) out.role = patch.role;
  if (patch.onboarding_completed !== undefined && patch.onboarding_completed !== null) {
    out.onboarding_completed = patch.onboarding_completed;
  }
  if (patch.organization_id !== undefined) out.organization_id = patch.organization_id || null;
  if (patch.proceeding_as_fan !== undefined && patch.proceeding_as_fan !== null) {
    out.proceeding_as_fan = patch.proceeding_as_fan;
  }
  if (patch.coach_agreement_accepted_at !== undefined) {
    out.coach_agreement_accepted_at =
      patch.coach_agreement_accepted_at === null
        ? null
        : asNullableDate(patch.coach_agreement_accepted_at);
  }
  if (patch.coach_agreement_version !== undefined) {
    out.coach_agreement_version = patch.coach_agreement_version;
  }

  return out;
}

export function getCanonicalAuthState(source: UserAuthStateSource | null | undefined) {
  return {
    role: getCanonicalUserRole(source),
    onboarding_completed: isUserOnboardingComplete(source),
    organization_id: getCanonicalOrganizationId(source),
    proceeding_as_fan: isProceedingAsFan(source),
    coach_agreement_accepted_at: getCoachAgreementAcceptedAt(source),
    coach_agreement_version: getCoachAgreementVersion(source),
  };
}
