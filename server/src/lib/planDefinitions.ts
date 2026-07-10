import { getAllPlanDefinitions } from './planLimits.js';

type PlanId = 'rookie' | 'veteran' | 'legend';

type RawPlanDefinition = {
  id: PlanId;
  price: string;
  period: string;
  max_teams: number | null;
  max_programs?: number | null;
};

type RawPlanDefinitions = Record<PlanId, RawPlanDefinition>;
// Reuse the hardened loader from planLimits.ts so Docker/local/dev/build all
// resolve the shared JSON from the same source of truth.
const planDefinitions = getAllPlanDefinitions() as RawPlanDefinitions;

function dollarsToCents(value: string) {
  const normalized = String(value || '').replace(/[^0-9.]/g, '');
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid plan price "${value}" in shared plan definitions`);
  }
  return Math.round(amount * 100);
}

export const SERVER_PLAN_DEFINITIONS = planDefinitions;
export const SERVER_ROOKIE_TEAM_LIMIT = planDefinitions.rookie.max_teams ?? 0;
// Free sport-program allowance (Phase 4 billing unit). max_teams is retained
// but vestigial for billing.
export const SERVER_ROOKIE_PROGRAM_LIMIT = planDefinitions.rookie.max_programs ?? 5;
export const SERVER_VETERAN_MIN_TOTAL_TEAMS = SERVER_ROOKIE_TEAM_LIMIT + 1;
export const SERVER_VETERAN_PRICE_CENTS = dollarsToCents(planDefinitions.veteran.price);
export const SERVER_VETERAN_PRICE_LABEL = `${planDefinitions.veteran.price}/month per additional team`;
export const SERVER_LEGEND_PRICE_CENTS = dollarsToCents(planDefinitions.legend.price);
export const SERVER_LEGEND_PRICE_LABEL = `${planDefinitions.legend.price}/year`;
