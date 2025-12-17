import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(moduleDir, '../../.env'),
];

// Load all .env files with override to merge values
// Later files override earlier ones (server/.env overrides root .env)
for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  config({ path: envPath, override: true });
  // Don't break - continue to merge all files
}
