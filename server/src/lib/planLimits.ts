import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve plan definitions file from multiple possible locations.
 *
 * Build process copies shared/ to dist/shared/ during npm run build.
 * Dockerfile also copies shared/ to /app/shared/ in the container.
 *
 * We check in order:
 * 1. dist/shared/plan-definitions.json (relative to compiled file)
 * 2. /app/shared/plan-definitions.json (Docker container path)
 * 3. /app/dist/shared/plan-definitions.json (Docker + build copy)
 * 4. process.cwd()/shared/plan-definitions.json (local dev)
 * 5. process.cwd()/dist/shared/plan-definitions.json (local build)
 * 6. Relative from the entrypoint directory (fallback)
 */
function resolvePlanDefinitionsPath(): string {
  const cwd = process.cwd();
  const entryDir = path.dirname(process.argv[1] || cwd);
  const candidatePaths = [
    // Absolute Docker paths
    '/app/shared/plan-definitions.json',
    '/app/dist/shared/plan-definitions.json',

    // Local development paths (relative to cwd)
    path.resolve(cwd, 'shared/plan-definitions.json'),
    path.resolve(cwd, 'dist/shared/plan-definitions.json'),
    path.resolve(cwd, '../shared/plan-definitions.json'),

    // Entrypoint-relative fallbacks for compiled or invoked scripts
    path.resolve(entryDir, '../shared/plan-definitions.json'),
    path.resolve(entryDir, '../../shared/plan-definitions.json'),
    path.resolve(entryDir, '../../../shared/plan-definitions.json'),
  ];

  // Remove duplicates while preserving order
  const uniquePaths = Array.from(new Set(candidatePaths));

  for (const candidatePath of uniquePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  // Enhanced error message with diagnostic info
  const checkedPaths = uniquePaths.map(p => `  - ${p}`).join('\n');
  const diagnosticInfo = [
    `Current working directory: ${cwd}`,
    `Process entry directory: ${entryDir}`,
    `Checked paths:\n${checkedPaths}`,
    `Directory contents at cwd: ${fs.existsSync(cwd) ? fs.readdirSync(cwd).join(', ') : 'does not exist'}`,
  ].join('\n');

  throw new Error(`plan-definitions.json not found in any expected location.\n\n${diagnosticInfo}`);
}

const planDefinitionsPath = resolvePlanDefinitionsPath();
const planDefinitions = JSON.parse(fs.readFileSync(planDefinitionsPath, 'utf8')) as Record<
  PlanId,
  RawPlanDefinition
>;

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

/**
 * Per-plan cap on concurrent ads (any status except 'rejected' or 'expired').
 * Policy lives in code rather than plan-definitions.json because it's an
 * anti-abuse throttle, not a product-facing pricing concept. Tune here.
 * `null` means unlimited.
 */
const AD_CONCURRENT_LIMITS: Record<PlanId, number | null> = {
  rookie: 1,
  veteran: 5,
  legend: null,
};

export function getMaxConcurrentAdsForPlan(plan?: string | null): number | null {
  return AD_CONCURRENT_LIMITS[resolvePlan(plan)];
}

export function getPlanDisplayName(plan?: string | null): string {
  return getPlanMeta(plan).name;
}

/** Returns all plan definitions for config endpoints (e.g. GET /payments/config). */
export function getAllPlanDefinitions(): Record<PlanId, RawPlanDefinition> {
  return planDefinitions;
}
