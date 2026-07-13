import {
  getCanonicalBillingState as getCanonicalBillingStateShared,
  getCanonicalPendingPlan as getCanonicalPendingPlanShared,
  getCanonicalPlan as getCanonicalPlanShared,
  getEffectiveEntitledPlan as getEffectiveEntitledPlanShared,
  getSelectedPlan as getSelectedPlanShared,
  isPaymentApproved as isPaymentApprovedShared,
  isPaymentPending as isPaymentPendingShared,
} from '@/shared/runtime/billingCore.js';

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

export function getCanonicalPlan(
  source: BillingUserLike | null | undefined
): CanonicalMembershipPlan {
  return getCanonicalPlanShared(source);
}

export function getCanonicalPendingPlan(
  source: BillingUserLike | null | undefined
): CanonicalMembershipPlan | null {
  return getCanonicalPendingPlanShared(source);
}

export function isPaymentPending(source: BillingUserLike | null | undefined): boolean {
  return isPaymentPendingShared(source);
}

export function isPaymentApproved(source: BillingUserLike | null | undefined): boolean {
  return isPaymentApprovedShared(source);
}

export function getSelectedPlan(
  source: BillingUserLike | null | undefined
): CanonicalMembershipPlan {
  return getSelectedPlanShared(source);
}

export function getEffectiveEntitledPlan(
  source: BillingUserLike | null | undefined
): CanonicalMembershipPlan {
  return getEffectiveEntitledPlanShared(source);
}

export function getCanonicalBillingState(source: BillingUserLike | null | undefined) {
  return getCanonicalBillingStateShared(source);
}
