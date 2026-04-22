import { getPreferencesObject } from './userAuthState.js';

export type CanonicalMembershipPlan = 'rookie' | 'veteran' | 'legend';

export type UserBillingStateSource = {
  plan?: CanonicalMembershipPlan | string | null;
  pending_plan?: CanonicalMembershipPlan | string | null;
  payment_pending?: boolean | null;
  payment_approved?: boolean | null;
  subscription_tier?: string | null;
  preferences?: unknown;
};

export type UserBillingStatePatch = {
  plan?: CanonicalMembershipPlan | null;
  pending_plan?: CanonicalMembershipPlan | null;
  payment_pending?: boolean | null;
  payment_approved?: boolean | null;
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

export function getCanonicalPlan(
  source: UserBillingStateSource | null | undefined,
): CanonicalMembershipPlan {
  const fromColumn = normalizePlan(source?.plan);
  if (fromColumn) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  const fromPrefs = normalizePlan(prefs.plan);
  if (fromPrefs) return fromPrefs;
  return normalizePlan(source?.subscription_tier) ?? 'rookie';
}

export function getCanonicalPendingPlan(
  source: UserBillingStateSource | null | undefined,
): CanonicalMembershipPlan | null {
  const fromColumn = normalizePlan(source?.pending_plan);
  if (fromColumn) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  return normalizePlan(prefs.pending_plan);
}

export function isPaymentPending(source: UserBillingStateSource | null | undefined): boolean {
  const fromColumn = asNullableBoolean(source?.payment_pending);
  if (fromColumn !== null) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  return prefs.payment_pending === true;
}

export function isPaymentApproved(source: UserBillingStateSource | null | undefined): boolean {
  const fromColumn = asNullableBoolean(source?.payment_approved);
  if (fromColumn !== null) return fromColumn;
  const prefs = getPreferencesObject(source?.preferences);
  return prefs.payment_approved === true;
}

export function getSelectedPlan(
  source: UserBillingStateSource | null | undefined,
): CanonicalMembershipPlan {
  return getCanonicalPendingPlan(source) ?? getCanonicalPlan(source);
}

export function getEffectiveEntitledPlan(
  source: UserBillingStateSource | null | undefined,
): CanonicalMembershipPlan {
  if (isPaymentPending(source)) return 'rookie';
  return getCanonicalPlan(source);
}

export function mergeBillingStateIntoPreferences(
  currentPreferences: unknown,
  patch: UserBillingStatePatch,
): Record<string, any> {
  const next = getPreferencesObject(currentPreferences);

  if (patch.plan !== undefined) {
    if (patch.plan === null) delete next.plan;
    else next.plan = patch.plan;
  }
  if (patch.pending_plan !== undefined) {
    if (patch.pending_plan === null) next.pending_plan = null;
    else next.pending_plan = patch.pending_plan;
  }
  if (patch.payment_pending !== undefined) {
    if (patch.payment_pending === null) delete next.payment_pending;
    else next.payment_pending = patch.payment_pending;
  }
  if (patch.payment_approved !== undefined) {
    if (patch.payment_approved === null) delete next.payment_approved;
    else next.payment_approved = patch.payment_approved;
  }

  return next;
}

export function buildBillingStateColumns(
  patch: UserBillingStatePatch,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (patch.plan !== undefined && patch.plan !== null) out.plan = patch.plan;
  if (patch.pending_plan !== undefined) out.pending_plan = patch.pending_plan ?? null;
  if (patch.payment_pending !== undefined && patch.payment_pending !== null) {
    out.payment_pending = patch.payment_pending;
  }
  if (patch.payment_approved !== undefined && patch.payment_approved !== null) {
    out.payment_approved = patch.payment_approved;
  }

  return out;
}

export function getCanonicalBillingState(
  source: UserBillingStateSource | null | undefined,
) {
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
