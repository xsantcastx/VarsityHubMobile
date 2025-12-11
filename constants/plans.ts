/**
 * Centralized Plan Definitions
 * 
 * Single source of truth for plan features, limits, and pricing.
 * Used by:
 * - Frontend: Step 3 plan selection, billing screens, UI components
 * - Backend: team creation, authorized user limits, extracurricular restrictions
 */

export type Plan = 'rookie' | 'veteran' | 'legend';

export interface PlanDefinition {
  id: Plan;
  name: string;
  icon: 'people' | 'trophy' | 'medal';
  price: string;
  period: string;
  priceId: string | null;
  
  // Limits
  max_teams: number;
  max_authorized_users_per_team: number;
  max_authorized_users_org: number | ((teamCount: number) => number);
  supports_extracurricular: boolean;
  
  // UI
  features: string[];
}

export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  rookie: {
    id: 'rookie',
    name: 'Rookie',
    icon: 'people',
    price: 'First two teams free',
    period: '',
    priceId: null,
    
    // Rookie limits
    max_teams: 2,
    max_authorized_users_per_team: 1,
    max_authorized_users_org: 1,
    supports_extracurricular: false,
    
    features: [
      'Entry-level access',
      'First two teams free',
      'Assign one administrator per team',
    ],
  },

  veteran: {
    id: 'veteran',
    name: 'Veteran',
    icon: 'trophy',
    price: '$2.50',
    period: '/ month per team added',
    priceId: 'prod_RNLc2l1BdUdSn9',
    
    // Veteran limits
    max_teams: 999, // unlimited (practical limit)
    max_authorized_users_per_team: 2,
    max_authorized_users_org: (teamCount) => teamCount * 2, // 2 per team
    supports_extracurricular: false,
    
    features: [
      'Everything in Rookie',
      '$2.50/month per additional team (3+ only)',
      'Up to 2 authorized users per team',
    ],
  },

  legend: {
    id: 'legend',
    name: 'Legend',
    icon: 'medal',
    price: '$19.99',
    period: '/ year',
    priceId: 'prod_RNLdYADy7i6dB5',
    
    // Legend limits
    max_teams: 999, // unlimited
    max_authorized_users_per_team: 999, // unlimited
    max_authorized_users_org: 999, // unlimited
    supports_extracurricular: true,
    
    features: [
      'Everything in Veteran',
      'Unlimited teams',
      'Create extracurricular clubs - Theater, Chess, Debate, etc.',
    ],
  },
} as const;

/**
 * Get plan definition by plan ID
 */
export function getPlanDefinition(planId: Plan | string | undefined): PlanDefinition {
  const plan = (planId as Plan) || 'rookie';
  return PLAN_DEFINITIONS[plan] || PLAN_DEFINITIONS.rookie;
}

/**
 * Get maximum authorized users for a plan
 */
export function getMaxAuthorizedUsers(planId: Plan | string | undefined, teamCount?: number): number {
  const plan = getPlanDefinition(planId);
  const limit = plan.max_authorized_users_org;
  
  if (typeof limit === 'function') {
    return limit(teamCount || 0);
  }
  
  return limit;
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
