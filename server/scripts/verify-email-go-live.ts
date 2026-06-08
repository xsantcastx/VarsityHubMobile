#!/usr/bin/env npx tsx
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPlaceholderSendGridApiKey, isValidSendGridApiKey } from '../src/lib/sendgridConfig.js';
import { loadRailwayVerificationEnv } from './lib/railwayVerificationEnv.js';

type ExportSummaryEntry = {
  key?: string;
  name?: string;
  env?: string;
  templateId?: string;
  status?: string;
  message?: string;
  file?: string;
};

type TestDataEntry = {
  env_var?: string;
  subject?: string;
};

type MetadataRecord = {
  env: string;
  name?: string;
  templateId?: string;
  status: 'ok' | 'unknown' | 'error';
  source: 'export-summary' | 'test-data' | 'manual';
  detail?: string;
  file?: string;
};

type TemplateGroup = {
  envs: string[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const exportSummaryPath = resolve(repoRoot, 'sendgrid-templates/export-summary.json');
const testDataPath = resolve(repoRoot, 'sendgrid-templates/test-data.json');
const emailLibPath = resolve(repoRoot, 'server/src/lib/email.ts');

const SENDGRID_TEMPLATE_ID_COMPACT_REGEX = /^d-[a-f0-9]{32}$/i;
const SENDGRID_TEMPLATE_ID_HYPHENATED_REGEX =
  /^d-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function isValidSendGridTemplateId(templateId: string | undefined | null): boolean {
  const trimmed = typeof templateId === 'string' ? templateId.trim() : '';
  return (
    SENDGRID_TEMPLATE_ID_COMPACT_REGEX.test(trimmed) ||
    SENDGRID_TEMPLATE_ID_HYPHENATED_REGEX.test(trimmed)
  );
}

function extractCanonicalTemplateEnvNames(source: string): string[] {
  const envs = new Set<string>();
  for (const match of source.matchAll(/\bSENDGRID_[A-Z0-9_]+_TEMPLATE_ID\b/g)) {
    envs.add(match[0]);
  }
  return [...envs].sort();
}

function extractTemplateGroups(source: string): TemplateGroup[] {
  const groups: TemplateGroup[] = [];
  for (const match of source.matchAll(/tmpl\(([\s\S]*?)\)/g)) {
    const envs = [...match[1].matchAll(/'([^']+)'/g)]
      .map(item => item[1])
      .filter(value => value.startsWith('SENDGRID_'));
    if (envs.length > 0) groups.push({ envs });
  }
  return groups;
}

function loadExportSummary(): ExportSummaryEntry[] {
  const payload = JSON.parse(readFileSync(exportSummaryPath, 'utf8')) as {
    summary?: ExportSummaryEntry[];
  };
  return Array.isArray(payload.summary) ? payload.summary : [];
}

function loadTestData(): Record<string, TestDataEntry> {
  return JSON.parse(readFileSync(testDataPath, 'utf8')) as Record<string, TestDataEntry>;
}

function buildMetadata(): Map<string, MetadataRecord> {
  const map = new Map<string, MetadataRecord>();

  for (const item of loadExportSummary()) {
    const env = String(item.env || '').trim();
    if (!env) continue;
    map.set(env, {
      env,
      name: item.name || item.key || env,
      templateId: item.templateId,
      status: item.status === 'ok' ? 'ok' : item.status === 'error' ? 'error' : 'unknown',
      source: 'export-summary',
      detail: item.message,
    });
  }

  const testData = loadTestData();
  for (const value of Object.values(testData)) {
    const env = String(value?.env_var || '').trim();
    if (!env || map.has(env)) continue;
    map.set(env, {
      env,
      name: env,
      status: 'unknown',
      source: 'test-data',
    });
  }

  const manualEntries: MetadataRecord[] = [
    {
      env: 'SENDGRID_AD_PAYMENT_CONFIRMED_TEMPLATE_ID',
      name: 'Ad Payment Confirmed',
      status: 'unknown',
      source: 'manual',
      file: 'sendgrid-templates/ad-payment-confirmed.html',
      detail: 'local export exists, but no published template ID is tracked in export-summary.json',
    },
    {
      env: 'SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID',
      name: 'Join Request Admin',
      status: 'unknown',
      source: 'manual',
      file: 'sendgrid-templates/join-request-admin.html',
      detail: 'local export exists, but no published template ID is tracked in export-summary.json',
    },
    {
      env: 'SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID',
      name: 'League Pending Approval',
      status: 'unknown',
      source: 'manual',
      file: 'sendgrid-templates/league-pending-approval.html',
      detail: 'local export exists, but no published template ID is tracked in export-summary.json',
    },
    {
      env: 'SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID',
      name: 'Parental Consent Request',
      status: 'unknown',
      source: 'manual',
      file: 'sendgrid-templates/parental-consent-request.html',
      detail: 'local export exists, but no published template ID is tracked in export-summary.json',
    },
    {
      env: 'SENDGRID_COACH_JOIN_REQUEST_OWNER_TEMPLATE_ID',
      name: 'Coach Join Request Owner',
      status: 'unknown',
      source: 'manual',
      detail:
        'no dedicated exported HTML is tracked; code falls back to the shared join-request-admin template',
    },
    {
      env: 'SENDGRID_EVENT_PENDING_REVIEW_TEMPLATE_ID',
      name: 'Event Pending Review',
      status: 'unknown',
      source: 'manual',
      detail:
        'no dedicated exported HTML is tracked; code falls back to the shared join-request-admin template',
    },
    {
      env: 'SENDGRID_AD_TAKEN_DOWN_PENDING_REVIEW_TEMPLATE_ID',
      name: 'Ad Takedown Pending Review',
      status: 'unknown',
      source: 'manual',
      detail: 'no SendGrid export is tracked; code already has a local HTML fallback',
    },
  ];

  for (const entry of manualEntries) {
    if (!map.has(entry.env)) map.set(entry.env, entry);
  }

  return map;
}

function printSection(title: string) {
  console.log(`\n## ${title}`);
}

function printList(items: string[]) {
  if (items.length === 0) {
    console.log('- none');
    return;
  }
  for (const item of items) console.log(`- ${item}`);
}

function main() {
  const railwayOverlay = loadRailwayVerificationEnv();
  const emailLib = readFileSync(emailLibPath, 'utf8');
  const canonicalEnvNames = extractCanonicalTemplateEnvNames(emailLib);
  const templateGroups = extractTemplateGroups(emailLib);
  const metadata = buildMetadata();

  const apiKey = process.env.SENDGRID_API_KEY || '';
  const apiKeyStatus = !apiKey
    ? 'missing'
    : isPlaceholderSendGridApiKey(apiKey)
      ? 'placeholder'
      : isValidSendGridApiKey(apiKey)
        ? 'valid'
        : 'invalid';

  const unsatisfiedGroups = templateGroups.filter(
    group => !group.envs.some(env => isValidSendGridTemplateId(process.env[env]))
  );
  const missingConfiguredEnvNames = unsatisfiedGroups.flatMap(group => group.envs);
  const missingMetadata = unsatisfiedGroups.filter(
    group => !group.envs.some(env => metadata.has(env))
  );
  const staleCatalog = canonicalEnvNames
    .map(env => metadata.get(env))
    .filter(
      (entry): entry is MetadataRecord =>
        Boolean(entry) &&
        entry.status === 'error' &&
        !isValidSendGridTemplateId(process.env[entry.env])
    );
  const readyToSet = unsatisfiedGroups
    .map(group => {
      const match = group.envs
        .map(env => ({ env, meta: metadata.get(env) }))
        .find(
          (entry): entry is { env: string; meta: MetadataRecord } =>
            Boolean(entry.meta) &&
            entry.meta.status === 'ok' &&
            isValidSendGridTemplateId(entry.meta.templateId)
        );
      return match || null;
    })
    .filter((entry): entry is { env: string; meta: MetadataRecord } => Boolean(entry));

  console.log('VarsityHub Email Go-Live Verification');
  console.log(`Repo root: ${repoRoot}`);
  console.log(`Canonical template envs referenced by code: ${canonicalEnvNames.length}`);
  console.log(`Template groups referenced by code: ${templateGroups.length}`);
  console.log(
    `Template groups currently satisfied in shell: ${templateGroups.length - unsatisfiedGroups.length}`
  );
  console.log(`SendGrid API key status: ${apiKeyStatus}`);
  if (railwayOverlay.loaded) {
    console.log(`Railway verification overlay: applied ${railwayOverlay.appliedKeys.length} vars`);
  }

  printSection('API Key');
  if (apiKeyStatus === 'valid') {
    console.log('- SENDGRID_API_KEY looks structurally valid');
  } else if (apiKeyStatus === 'placeholder') {
    console.log('- SENDGRID_API_KEY is still a placeholder and must be replaced in Railway');
  } else if (apiKeyStatus === 'missing') {
    console.log('- SENDGRID_API_KEY is missing');
  } else {
    console.log('- SENDGRID_API_KEY is present but structurally invalid');
  }

  printSection('Unset Or Invalid Template Env Vars');
  printList(
    unsatisfiedGroups.map(group => {
      return group.envs
        .map(env => {
          const meta = metadata.get(env);
          const suffix = meta?.status === 'error' ? ' [catalog stale]' : '';
          return `${env}${suffix}`;
        })
        .join(' OR ');
    })
  );

  printSection('Stale Catalog Entries');
  printList(
    staleCatalog.map(
      entry =>
        `${entry.env} -> ${entry.templateId || 'missing id'}${entry.detail ? ` (${entry.detail})` : ''}`
    )
  );

  printSection('Code Env Vars Missing Export Metadata');
  printList(missingMetadata.map(group => group.envs.join(' OR ')));

  printSection('Railway Commands Ready To Paste');
  if (readyToSet.length === 0) {
    console.log('- none');
  } else {
    for (const entry of readyToSet) {
      console.log(`railway variables set ${entry.env}='${entry.meta.templateId}'`);
    }
  }

  printSection('Next Steps');
  const nextSteps: string[] = [];
  if (apiKeyStatus !== 'valid') {
    nextSteps.push('Replace SENDGRID_API_KEY in Railway with a real production key');
  }
  if (readyToSet.length > 0) {
    nextSteps.push('Apply the Railway commands above for any unset template IDs');
  }
  if (staleCatalog.length > 0) {
    nextSteps.push(
      'Recreate/publish the stale SendGrid templates listed above before setting those env vars'
    );
  }
  if (missingMetadata.length > 0) {
    nextSteps.push(
      'Backfill export metadata for any code env vars missing from sendgrid-templates/export-summary.json or test-data.json'
    );
  }
  nextSteps.push('Run `npm --prefix server run verify:email` after updating Railway');
  nextSteps.push(
    'Run `npx tsx server/scripts/email-delivery-test.ts` against a real test inbox after verify:email passes'
  );
  printList(nextSteps);

  const shouldFail =
    apiKeyStatus !== 'valid' || unsatisfiedGroups.length > 0 || missingMetadata.length > 0;

  if (shouldFail) {
    process.exitCode = 1;
  }
}

main();
