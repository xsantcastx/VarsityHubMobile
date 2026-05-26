import {
    getCanonicalBillingState as getCanonicalBillingStateShared,
    getCanonicalPendingPlan as getCanonicalPendingPlanShared,
    getCanonicalPlan as getCanonicalPlanShared,
    getEffectiveEntitledPlan as getEffectiveEntitledPlanShared,
    getSelectedPlan as getSelectedPlanShared,
    isPaymentApproved as isPaymentApprovedShared,
    isPaymentPending as isPaymentPendingShared,
} from '@varsityhub/shared/runtime/billingCore';
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

export function getCanonicalPlan(
  source: UserBillingStateSource | null | undefined,
): CanonicalMembershipPlan {
  return getCanonicalPlanShared(source);
}

export function getCanonicalPendingPlan(
  source: UserBillingStateSource | null | undefined,
): CanonicalMembershipPlan | null {
  return getCanonicalPendingPlanShared(source);
}

export function isPaymentPending(source: UserBillingStateSource | null | undefined): boolean {
  return isPaymentPendingShared(source);
}

export function isPaymentApproved(source: UserBillingStateSource | null | undefined): boolean {
  return isPaymentApprovedShared(source);
}

export function getSelectedPlan(
  source: UserBillingStateSource | null | undefined,
): CanonicalMembershipPlan {
  return getSelectedPlanShared(source);
}

export function getEffectiveEntitledPlan(
  source: UserBillingStateSource | null | undefined,
): CanonicalMembershipPlan {
  return getEffectiveEntitledPlanShared(source);
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
  return getCanonicalBillingStateShared(source);
}
