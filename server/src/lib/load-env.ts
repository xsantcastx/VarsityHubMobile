import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const explicitEnvPath = process.env.VARSITYHUB_ENV_PATH
  ? path.resolve(process.env.VARSITYHUB_ENV_PATH)
  : path.resolve(moduleDir, '../../.env');

if (fs.existsSync(explicitEnvPath)) {
  config({ path: explicitEnvPath });
}
