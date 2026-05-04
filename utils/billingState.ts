type CanonicalMembershipPlan = 'rookie' | 'veteran' | 'legend';

type BillingPreferencesLike = {
  plan?: string | null;
  pending_plan?: string | null;
  payment_pending?: boolean | null;
  payment_approved?: boolean | null;
};

export type BillingUserLike = {
  plan?: string | null;
  pending_plan?: string | null;
  payment_pending?: boolean | null;
  payment_approved?: boolean | null;
  subscription_tier?: string | null;
  preferences?: BillingPreferencesLike | null;
};

function normalizePlan(raw: unknown): CanonicalMembershipPlan | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === 'legend' || value === 'pro') return 'legend';
  if (value === 'veteran' || value === 'premium') return 'veteran';
  if (value === 'rookie' || value === 'free') return 'rookie';
  return null;
}

function asNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function getPreferences(source: BillingUserLike | null | undefined): BillingPreferencesLike {
  const prefs = source?.preferences;
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return {};
  return prefs;
}

export function getCanonicalPlan(source: BillingUserLike | null | undefined): CanonicalMembershipPlan {
  const fromColumn = normalizePlan(source?.plan);
  if (fromColumn) return fromColumn;
  const fromPrefs = normalizePlan(getPreferences(source).plan);
  if (fromPrefs) return fromPrefs;
  return normalizePlan(source?.subscription_tier) ?? 'rookie';
}

export function getCanonicalPendingPlan(
  source: BillingUserLike | null | undefined
): CanonicalMembershipPlan | null {
  if (source?.pending_plan === null) return null;
  const fromColumn = normalizePlan(source?.pending_plan);
  if (fromColumn) return fromColumn;
  return normalizePlan(getPreferences(source).pending_plan);
}

export function isPaymentPending(source: BillingUserLike | null | undefined): boolean {
  const fromColumn = asNullableBoolean(source?.payment_pending);
  if (fromColumn !== null) return fromColumn;
  return getPreferences(source).payment_pending === true;
}

export function isPaymentApproved(source: BillingUserLike | null | undefined): boolean {
  const fromColumn = asNullableBoolean(source?.payment_approved);
  if (fromColumn !== null) return fromColumn;
  return getPreferences(source).payment_approved === true;
}

export function getSelectedPlan(source: BillingUserLike | null | undefined): CanonicalMembershipPlan {
  return getCanonicalPendingPlan(source) ?? getCanonicalPlan(source);
}

export function getEffectiveEntitledPlan(
  source: BillingUserLike | null | undefined
): CanonicalMembershipPlan {
  if (isPaymentPending(source)) return 'rookie';
  return getCanonicalPlan(source);
}

export function getCanonicalBillingState(source: BillingUserLike | null | undefined) {
  const plan = getCanonicalPlan(source);
  const pending_plan = getCanonicalPendingPlan(source);
  const payment_pending = isPaymentPending(source);
  const payment_approved = isPaymentApproved(source);

  return {
    plan,
    pending_plan,
    payment_pending,
    payment_approved,
    selected_plan: pending_plan ?? plan,
    effective_plan: payment_pending ? 'rookie' : plan,
  };
}
