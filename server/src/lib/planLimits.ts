import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the shared plan definitions regardless of where build copies them.
// Primary: dist/shared/plan-definitions.json (copied during build)
// Fallback: /app/shared/plan-definitions.json (legacy path)
const candidatePaths = [
  path.resolve(__dirname, '../../shared/plan-definitions.json'), // dist/shared
  path.resolve(__dirname, '../../../shared/plan-definitions.json'), // /app/shared
];

const planDefinitionsPath = candidatePaths.find((p) => fs.existsSync(p));

if (!planDefinitionsPath) {
  throw new Error(
    `plan-definitions.json not found in any expected location: ${candidatePaths.join(', ')}`
  );
}

const planDefinitions = require(planDefinitionsPath) as Record<PlanId, RawPlanDefinition>;

export type PlanId = 'rookie' | 'veteran' | 'legend';

type AuthorizedUsersOrgStrategy =
  | { type: 'fixed'; value: number }
  | { type: 'per_team'; value: number }
  | { type: 'unlimited' };

interface RawPlanDefinition {
  id: PlanId;
  name: string;
  icon: 'people' | 'trophy' | 'medal';
  price: string;
  period: string;
  priceId: string | null;
  max_teams: number | null;
  max_authorized_users_per_team: number | null;
  authorized_users_org_strategy: AuthorizedUsersOrgStrategy;
  supports_extracurricular: boolean;
  features: string[];
}

function toPlanId(input?: string | null): PlanId {
  const value = String(input ?? 'rookie').toLowerCase();
  if (value === 'free') return 'rookie';
  if (value === 'premium' || value === 'pro') return 'veteran';
  if (value === 'veteran') return 'veteran';
  if (value === 'legend') return 'legend';
  return 'rookie';
}

export function resolvePlan(plan?: string | null): PlanId {
  return toPlanId(plan);
}

export function getPlanMeta(plan?: string | null): RawPlanDefinition {
  const normalized = resolvePlan(plan);
  return planDefinitions[normalized] ?? planDefinitions.rookie;
}

export function getMaxTeamsForPlan(plan?: string | null): number | null {
  return getPlanMeta(plan).max_teams ?? null;
}

export function getAuthorizedUsersPerTeam(plan?: string | null): number | null {
  return getPlanMeta(plan).max_authorized_users_per_team ?? null;
}

export function getAuthorizedUsersOrgLimit(
  plan?: string | null,
  teamCount: number = 0
): number | null {
  const strategy = getPlanMeta(plan).authorized_users_org_strategy;
  switch (strategy.type) {
    case 'fixed':
      return strategy.value;
    case 'per_team':
      return Math.max(0, teamCount) * strategy.value;
    default:
      return null;
  }
}

export function planSupportsExtracurricular(plan?: string | null): boolean {
  return getPlanMeta(plan).supports_extracurricular;
}

export function getPlanDisplayName(plan?: string | null): string {
  return getPlanMeta(plan).name;
}
