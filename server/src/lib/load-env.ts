import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  config({ path: envPath });
  break;
}
