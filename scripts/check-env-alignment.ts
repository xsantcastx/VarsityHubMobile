import fs from 'fs';
import path from 'path';

type KeyStatus = {
  key: string;
  rootValue?: string;
  serverValue?: string;
  presentInRoot: boolean;
  presentInServer: boolean;
  matches: boolean;
};

type EnvSource = {
  values: Record<string, string>;
  usedPath?: string;
  usedLabel: 'primary' | 'fallback' | 'missing';
  primaryPath: string;
  fallbackPath?: string;
};

const REQUIRED_KEYS = [
  'SENDGRID_API_KEY',
  'SENDGRID_VERIFICATION_TEMPLATE_ID',
  'SENDGRID_PASSWORD_RESET_TEMPLATE_ID',
  'SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID',
  'SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID',
  'SENDGRID_TEAM_INVITE_TEMPLATE_ID',
  'EMAIL_FROM',
];

function readEnv(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const out: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv(primaryPath: string, fallbackPath?: string): EnvSource {
  const primaryExists = fs.existsSync(primaryPath);
  const fallbackExists = fallbackPath ? fs.existsSync(fallbackPath) : false;

  if (primaryExists) {
    return {
      values: readEnv(primaryPath),
      usedPath: primaryPath,
      usedLabel: 'primary',
      primaryPath,
      fallbackPath,
    };
  }

  if (fallbackExists && fallbackPath) {
    return {
      values: readEnv(fallbackPath),
      usedPath: fallbackPath,
      usedLabel: 'fallback',
      primaryPath,
      fallbackPath,
    };
  }

  return {
    values: {},
    usedLabel: 'missing',
    primaryPath,
    fallbackPath,
  };
}

function describeSource(source: EnvSource): string {
  const relativize = (filePath: string) => path.relative(process.cwd(), filePath);
  if (source.usedLabel === 'primary' && source.usedPath) {
    return `${relativize(source.usedPath)} (primary)`;
  }
  if (source.usedLabel === 'fallback' && source.usedPath) {
    return `${relativize(source.usedPath)} (fallback)`;
  }
  const candidates = [relativize(source.primaryPath)];
  if (source.fallbackPath) {
    candidates.push(relativize(source.fallbackPath));
  }
  return `missing (${candidates.join(' or ')})`;
}

function main() {
  const rootEnvPath = path.resolve(process.cwd(), '.env');
  const rootExamplePath = path.resolve(process.cwd(), '.env.example');
  const serverEnvPath = path.resolve(process.cwd(), 'server/.env');
  const serverExamplePath = path.resolve(process.cwd(), 'server/.env.example');

  const rootEnvSource = loadEnv(rootEnvPath, rootExamplePath);
  const serverEnvSource = loadEnv(serverEnvPath, serverExamplePath);

  const rootEnv = rootEnvSource.values;
  const serverEnv = serverEnvSource.values;

  if (!rootEnv.EMAIL_FROM && rootEnv.FROM_EMAIL) {
    rootEnv.EMAIL_FROM = rootEnv.FROM_EMAIL;
  }
  if (!serverEnv.EMAIL_FROM && serverEnv.FROM_EMAIL) {
    serverEnv.EMAIL_FROM = serverEnv.FROM_EMAIL;
  }

  const statuses: KeyStatus[] = REQUIRED_KEYS.map((key) => {
    const rootVal = rootEnv[key];
    const serverVal = serverEnv[key];
    return {
      key,
      rootValue: rootVal,
      serverValue: serverVal,
      presentInRoot: rootVal != null && rootVal !== '',
      presentInServer: serverVal != null && serverVal !== '',
      matches:
        rootVal != null && serverVal != null && rootVal !== '' && serverVal !== ''
          ? rootVal === serverVal
          : false,
    };
  });

  const missing = statuses.filter((s) => !s.presentInRoot || !s.presentInServer);
  const mismatched = statuses.filter((s) => s.presentInRoot && s.presentInServer && !s.matches);

  const lines: string[] = [];
  lines.push('# Env Alignment Report');
  lines.push('');
  lines.push(`Root env source: ${describeSource(rootEnvSource)}`);
  lines.push(`Server env source: ${describeSource(serverEnvSource)}`);
  lines.push('');
  for (const s of statuses) {
    lines.push(`- ${s.key}: root=${s.presentInRoot ? 'set' : 'missing'} | server=${s.presentInServer ? 'set' : 'missing'} | matches=${s.matches ? 'yes' : 'no'}`);
  }
  lines.push('');
  if (missing.length === 0 && mismatched.length === 0) {
    lines.push('✅ All required keys are present and aligned.');
    console.log(lines.join('\n'));
    fs.writeFileSync(path.resolve(process.cwd(), 'ENV_ALIGNMENT_REPORT.md'), lines.join('\n'));
    process.exit(0);
  }
  if (missing.length > 0) {
    lines.push('❌ Missing keys:');
    for (const s of missing) {
      lines.push(`  - ${s.key} (root: ${s.presentInRoot ? 'set' : 'missing'}, server: ${s.presentInServer ? 'set' : 'missing'})`);
    }
  }
  if (mismatched.length > 0) {
    lines.push('❌ Mismatched values:');
    for (const s of mismatched) {
      lines.push(`  - ${s.key}`);
    }
  }
  console.log(lines.join('\n'));
  fs.writeFileSync(path.resolve(process.cwd(), 'ENV_ALIGNMENT_REPORT.md'), lines.join('\n'));
  process.exit(1);
}

main();
