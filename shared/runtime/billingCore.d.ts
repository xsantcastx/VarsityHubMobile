export type CanonicalMembershipPlan = 'rookie' | 'veteran' | 'legend';

export type BillingPreferencesLike = {
  plan?: string | null;
  pending_plan?: string | null;
  payment_pending?: boolean | null;
  payment_approved?: boolean | null;
};

export type BillingSourceLike = {
  plan?: string | null;
  pending_plan?: string | null;
  payment_pending?: boolean | null;
  payment_approved?: boolean | null;
  subscription_tier?: string | null;
  preferences?: BillingPreferencesLike | null | unknown;
};

export function normalizePlan(raw: unknown): CanonicalMembershipPlan | null;
export function getCanonicalPlan(source: BillingSourceLike | null | undefined): CanonicalMembershipPlan;
export function getCanonicalPendingPlan(
  source: BillingSourceLike | null | undefined,
): CanonicalMembershipPlan | null;
export function isPaymentPending(source: BillingSourceLike | null | undefined): boolean;
export function isPaymentApproved(source: BillingSourceLike | null | undefined): boolean;
export function getSelectedPlan(source: BillingSourceLike | null | undefined): CanonicalMembershipPlan;
export function getEffectiveEntitledPlan(
  source: BillingSourceLike | null | undefined,
): CanonicalMembershipPlan;
export function getCanonicalBillingState(source: BillingSourceLike | null | undefined): {
  plan: CanonicalMembershipPlan;
  pending_plan: CanonicalMembershipPlan | null;
  payment_pending: boolean;
  payment_approved: boolean;
  selected_plan: CanonicalMembershipPlan;
  effective_plan: CanonicalMembershipPlan;
};
