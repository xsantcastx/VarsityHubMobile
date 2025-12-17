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

const REQUIRED_KEYS = [
  'SENDGRID_API_KEY',
  'SENDGRID_VERIFICATION_TEMPLATE_ID',
  'SENDGRID_PASSWORD_RESET_TEMPLATE_ID',
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

function main() {
  const rootEnvPath = path.resolve(process.cwd(), '.env');
  const serverEnvPath = path.resolve(process.cwd(), 'server/.env');

  const rootEnv = readEnv(rootEnvPath);
  const serverEnv = readEnv(serverEnvPath);

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
  lines.push(`Root .env: ${fs.existsSync(rootEnvPath) ? 'found' : 'missing'}`);
  lines.push(`Server .env: ${fs.existsSync(serverEnvPath) ? 'found' : 'missing'}`);
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
