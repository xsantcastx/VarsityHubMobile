/**
 * Centralized Plan Definitions
 *
 * Single source of truth for plan features, limits, and pricing.
 * Shared between the mobile app (via this wrapper) and the backend (via shared/plan-definitions.json).
 */

import planDefinitionsData from '../shared/plan-definitions.json';

export type Plan = 'rookie' | 'veteran' | 'legend';

type AuthorizedUsersOrgStrategy =
  | { type: 'fixed'; value: number }
  | { type: 'per_team'; value: number }
  | { type: 'unlimited' };

interface RawPlanDefinition {
  id: Plan;
  name: string;
  icon: 'people' | 'trophy' | 'medal';
  price: string;
  period: string;
  priceId: string | null;
  max_teams: number | null;
  max_authorized_users_per_team: number | null;
  max_roster_size_per_team: number | null;
  authorized_users_org_strategy: AuthorizedUsersOrgStrategy;
  supports_extracurricular: boolean;
  features: string[];
  billing?: {
    description: string;
    cta: string;
  };
}

export interface PlanDefinition {
  id: Plan;
  name: string;
  icon: 'people' | 'trophy' | 'medal';
  price: string;
  period: string;
  priceId: string | null;
  max_teams: number | null;
  max_authorized_users_per_team: number | null;
  max_roster_size_per_team: number | null;
  max_authorized_users_org: number | null | ((teamCount: number) => number);
  supports_extracurricular: boolean;
  features: string[];
  billing?: {
    description: string;
    cta: string;
  };
}

const RAW_PLAN_DEFINITIONS = planDefinitionsData as Record<Plan, RawPlanDefinition>;

const mapRawPlan = (raw: RawPlanDefinition): PlanDefinition => {
  let orgLimit: PlanDefinition['max_authorized_users_org'];
  const strategy = raw.authorized_users_org_strategy;

  switch (strategy.type) {
    case 'fixed':
      orgLimit = strategy.value;
      break;
    case 'per_team':
      orgLimit = (teamCount: number) => Math.max(0, teamCount) * strategy.value;
      break;
    default:
      orgLimit = null;
  }

  return {
    id: raw.id,
    name: raw.name,
    icon: raw.icon,
    price: raw.price,
    period: raw.period,
    priceId: raw.priceId,
    max_teams: raw.max_teams,
    max_authorized_users_per_team: raw.max_authorized_users_per_team,
    max_roster_size_per_team: raw.max_roster_size_per_team,
    max_authorized_users_org: orgLimit,
    supports_extracurricular: raw.supports_extracurricular,
    features: raw.features,
    billing: raw.billing,
  };
};

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = Object.fromEntries(
  Object.entries(RAW_PLAN_DEFINITIONS).map(([id, raw]) => [id, mapRawPlan(raw)])
) as Record<Plan, PlanDefinition>;

export const ROOKIE_TEAM_LIMIT = PLAN_DEFINITIONS.rookie.max_teams ?? 0;
export const VETERAN_MIN_TOTAL_TEAMS = ROOKIE_TEAM_LIMIT + 1;
export const VETERAN_MONTHLY_TEAM_PRICE_LABEL = `${PLAN_DEFINITIONS.veteran.price}/month per team over ${ROOKIE_TEAM_LIMIT}`;
export const LEGEND_YEARLY_PRICE_LABEL = `${PLAN_DEFINITIONS.legend.price}/year`;

export function formatIncludedTeamAllowance(): string {
  return `${ROOKIE_TEAM_LIMIT} team${ROOKIE_TEAM_LIMIT === 1 ? '' : 's'}`;
}

export function formatVeteranPlanSummary(): string {
  return `First ${ROOKIE_TEAM_LIMIT} teams free, then ${PLAN_DEFINITIONS.veteran.price}/month per additional team.`;
}

export function formatLegendPlanSummary(): string {
  return `${LEGEND_YEARLY_PRICE_LABEL} unlimited.`;
}

/**
 * Get plan definition by plan ID
 */
export function getPlanDefinition(planId: Plan | string | undefined): PlanDefinition {
  const normalized = normalizePlan(planId);
  return PLAN_DEFINITIONS[normalized] || PLAN_DEFINITIONS.rookie;
}

/**
 * Normalize arbitrary plan strings to canonical ids
 */
export function normalizePlan(planId: Plan | string | undefined): Plan {
  const value = String(planId ?? 'rookie').toLowerCase();
  if (value === 'free') return 'rookie';
  if (value === 'premium') return 'veteran';
  // 'pro' aliases to legend, matching the canonical shared/runtime/billingCore.js
  // PLAN_ALIASES (pro: 'legend') and server planLimits.ts. Previously mapped to
  // veteran here, so the same 'pro' string granted different entitlements per side.
  if (value === 'pro' || value === 'legend') return 'legend';
  if (value === 'veteran') return 'veteran';
  return 'rookie';
}

/**
 * Get maximum authorized users for a plan
 */
export function getMaxAuthorizedUsers(
  planId: Plan | string | undefined,
  teamCount?: number
): number | null {
  const plan = getPlanDefinition(planId);
  const limit = plan.max_authorized_users_org;

  if (typeof limit === 'function') {
    return limit(teamCount || 0);
  }

  return limit ?? null;
}

/**
 * Check if plan supports extracurricular clubs
 */
export function supportsExtracurricular(planId: Plan | string | undefined): boolean {
  return getPlanDefinition(planId).supports_extracurricular;
}

/**
 * Get all plans as array (for UI components)
 */
export function getAllPlans(): PlanDefinition[] {
  return Object.values(PLAN_DEFINITIONS);
}

/**
 * Format price for display
 */
export function formatPlanPrice(planId: Plan | string | undefined): string {
  const plan = getPlanDefinition(planId);
  return plan.price ? `${plan.price}${plan.period ? ` ${plan.period}` : ''}` : 'Free';
}
