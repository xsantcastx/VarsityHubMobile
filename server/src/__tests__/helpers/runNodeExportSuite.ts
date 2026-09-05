import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { expect } from '@jest/globals';

/** Normal Node avoids Jest VM's AWS/Sentry/Express ESM linking collision. */
export async function runNodeExportSuite(name: string) {
  const database = new URL(process.env.DATABASE_URL || '');
  if (!['127.0.0.1', 'localhost'].includes(database.hostname)) {
    throw new Error('Export regressions require an isolated local test database');
  }
  database.searchParams.set('connection_limit', '8');
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      '--import',
      'tsx',
      '--test',
      '--test-reporter=tap',
      '--test-force-exit',
      fileURLToPath(new URL(`../fixtures/${name}.mts`, import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        VARSITYHUB_ENV_PATH: '/dev/null',
        DOTENV_CONFIG_PATH: '/dev/null',
        DATABASE_URL: database.toString(),
        JWT_SECRET: 'local-export-regression-secret',
        NODE_ENV: 'test',
        EMAIL_PROVIDER: 'test',
      },
      timeout: 40000,
      maxBuffer: 4 * 1024 * 1024,
    }
  );
  expect(stdout).toMatch(/# fail 0/);
  expect(stdout).toMatch(/# skipped 0/);
  console.log(`${name}: ${stdout.match(/# tests \d+/)?.[0]}; # fail 0; # skipped 0`);
}
