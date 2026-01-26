import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * 6. Relative from __dirname (fallback)
 */
function resolvePlanDefinitionsPath(): string {
  const cwd = process.cwd();
  const candidatePaths = [
    // Relative paths from compiled file location (most common in production)
    path.resolve(__dirname, '../../shared/plan-definitions.json'), // dist/lib -> dist/shared
    path.resolve(__dirname, '../../../shared/plan-definitions.json'), // dist/lib -> shared
    
    // Absolute Docker paths
    '/app/shared/plan-definitions.json',
    '/app/dist/shared/plan-definitions.json',
    
    // Local development paths (relative to cwd)
    path.resolve(cwd, 'shared/plan-definitions.json'),
    path.resolve(cwd, 'dist/shared/plan-definitions.json'),
    path.resolve(cwd, '../shared/plan-definitions.json'),
    
    // Additional fallbacks
    path.resolve(__dirname, '../../../../shared/plan-definitions.json'),
    path.resolve(__dirname, '../../../../../shared/plan-definitions.json'),
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
    `Compiled file location: ${__dirname}`,
    `Checked paths:\n${checkedPaths}`,
    `Directory contents at __dirname: ${fs.existsSync(__dirname) ? fs.readdirSync(__dirname).join(', ') : 'does not exist'}`,
  ].join('\n');

  throw new Error(
    `plan-definitions.json not found in any expected location.\n\n${diagnosticInfo}`
  );
}

const planDefinitionsPath = resolvePlanDefinitionsPath();

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
