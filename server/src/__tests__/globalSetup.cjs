const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { config } = require('dotenv');

const candidatePaths = [path.resolve(process.cwd(), '.env'), path.resolve(__dirname, '../../.env')];

for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  config({ path: envPath });
  break;
}

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/varsityhub_test';

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  execFileSync(
    process.execPath,
    [
      path.resolve(__dirname, '../../node_modules/prisma/build/index.js'),
      'db',
      'push',
      '--skip-generate',
      '--schema',
      path.resolve(__dirname, '../../prisma/schema.prisma'),
    ],
    {
      cwd: path.resolve(__dirname, '../..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: TEST_DATABASE_URL,
      },
      stdio: 'inherit',
    }
  );
};
