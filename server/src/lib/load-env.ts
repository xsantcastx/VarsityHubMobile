import { parse } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(moduleDir, '../../.env'),
];

// Preserve any environment variables that were already set (e.g., via shell)
const originalEnvKeys = new Set(Object.keys(process.env));

// Merge env files with later files overriding earlier ones, but never override
// values that were already present in the environment when the process started.
const mergedFromFiles: Record<string, string> = {};
for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  const parsed = parse(fs.readFileSync(envPath));
  Object.assign(mergedFromFiles, parsed);
}

for (const [key, value] of Object.entries(mergedFromFiles)) {
  if (originalEnvKeys.has(key)) continue;
  process.env[key] = value;
}
