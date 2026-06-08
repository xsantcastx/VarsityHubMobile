import { execFileSync } from 'node:child_process';
import { isValidSendGridApiKey } from '../../src/lib/sendgridConfig.js';

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

function shouldPreferRailwayValue(
  key: string,
  currentValue: string | undefined,
  railwayValue: string
): boolean {
  const current = typeof currentValue === 'string' ? currentValue.trim() : '';
  const incoming = railwayValue.trim();
  if (!incoming) return false;

  if (key === 'SENDGRID_API_KEY') {
    return !isValidSendGridApiKey(current) && isValidSendGridApiKey(incoming);
  }

  if (key.startsWith('SENDGRID_') && (key.endsWith('_TEMPLATE_ID') || !key.includes('API_KEY'))) {
    return !isValidSendGridTemplateId(current) && isValidSendGridTemplateId(incoming);
  }

  return !current;
}

export function loadRailwayVerificationEnv(): {
  loaded: boolean;
  source: string;
  appliedKeys: string[];
} {
  if (process.env.VERIFY_EMAIL_SKIP_RAILWAY === '1') {
    return { loaded: false, source: 'skipped', appliedKeys: [] };
  }

  try {
    const raw = execFileSync('railway', ['variables', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const vars = JSON.parse(raw) as Record<string, string>;
    const appliedKeys: string[] = [];

    for (const [key, value] of Object.entries(vars)) {
      if (
        key === 'SENDGRID_API_KEY' ||
        key === 'SENDGRID_FROM_EMAIL' ||
        key === 'EMAIL_FROM' ||
        key === 'FROM_EMAIL' ||
        key === 'API_BASE_URL' ||
        key === 'APP_BASE_URL' ||
        key.startsWith('SENDGRID_')
      ) {
        if (shouldPreferRailwayValue(key, process.env[key], String(value))) {
          process.env[key] = String(value).trim();
          appliedKeys.push(key);
        }
      }
    }

    return {
      loaded: appliedKeys.length > 0,
      source: 'railway',
      appliedKeys,
    };
  } catch {
    return { loaded: false, source: 'unavailable', appliedKeys: [] };
  }
}
