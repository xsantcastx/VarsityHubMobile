const PLAN_ALIASES = Object.freeze({
  legend: 'legend',
  pro: 'legend',
  veteran: 'veteran',
  premium: 'veteran',
  rookie: 'rookie',
  free: 'rookie',
});

function getPreferences(source) {
  const prefs = source?.preferences;
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return {};
  return prefs;
}

function asNullableBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

export function normalizePlan(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  return PLAN_ALIASES[value] ?? null;
}

export function getCanonicalPlan(source) {
  const fromColumn = normalizePlan(source?.plan);
  if (fromColumn) return fromColumn;
  const fromPrefs = normalizePlan(getPreferences(source).plan);
  if (fromPrefs) return fromPrefs;
  return normalizePlan(source?.subscription_tier) ?? 'rookie';
}

export function getCanonicalPendingPlan(source) {
  if (source?.pending_plan === null) return null;
  const fromColumn = normalizePlan(source?.pending_plan);
  if (fromColumn) return fromColumn;
  return normalizePlan(getPreferences(source).pending_plan);
}

export function isPaymentPending(source) {
  const fromColumn = asNullableBoolean(source?.payment_pending);
  if (fromColumn !== null) return fromColumn;
  return getPreferences(source).payment_pending === true;
}

export function isPaymentApproved(source) {
  const fromColumn = asNullableBoolean(source?.payment_approved);
  if (fromColumn !== null) return fromColumn;
  return getPreferences(source).payment_approved === true;
}

export function getSelectedPlan(source) {
  return getCanonicalPendingPlan(source) ?? getCanonicalPlan(source);
}

export function getEffectiveEntitledPlan(source) {
  if (isPaymentPending(source)) return 'rookie';
  return getCanonicalPlan(source);
}

export function getCanonicalBillingState(source) {
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
