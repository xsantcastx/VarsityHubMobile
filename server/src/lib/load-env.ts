import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(moduleDir, '../../.env'),
  path.resolve(moduleDir, '../../../.env'),
];

for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  config({ path: envPath });
  break;
}
