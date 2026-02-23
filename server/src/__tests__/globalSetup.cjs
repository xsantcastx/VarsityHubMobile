/**
 * Jest globalSetup - runs once before all tests
 * When DB/integration tests are enabled, sets up the test database:
 * creates user, database, runs migrations, seeds minimal data
 */
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

module.exports = async function globalSetup() {
  const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
  const skipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
  const skipIntegrationTests = isCi || process.env.RUN_SERVER_INTEGRATION_TESTS !== '1';

  if (skipDbTests && skipIntegrationTests) return;

  const serverRoot = path.resolve(__dirname, '../..');
  const setupScript = path.join(serverRoot, 'scripts', 'setup-test-db.sh');

  if (!fs.existsSync(setupScript)) {
    console.warn('[globalSetup] setup-test-db.sh not found, skipping test DB setup');
    return;
  }

  try {
    execSync(`bash "${setupScript}"`, {
      cwd: serverRoot,
      stdio: 'inherit',
      env: { ...process.env, PGHOST: process.env.PGHOST || 'localhost', PGPORT: process.env.PGPORT || '5432' },
    });
  } catch (err) {
    console.error('[globalSetup] Test DB setup failed. Ensure PostgreSQL is running and psql is in PATH.');
    console.error('[globalSetup] You can create the DB manually:');
    console.error('[globalSetup]   createdb varsityhub_test');
    console.error('[globalSetup]   createuser test -P');
    console.error('[globalSetup]   DATABASE_URL=postgresql://test:test@localhost:5432/varsityhub_test npx prisma migrate deploy');
    console.error('[globalSetup]   SEED_PASSWORD=testpassword DATABASE_URL=... npx tsx prisma/seed.ts');
    throw err;
  }
};
