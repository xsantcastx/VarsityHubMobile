#!/usr/bin/env bash
# Setup PostgreSQL test database for integration tests
# Creates varsityhub_test database, runs migrations, seeds minimal test data
# Run automatically before integration test suite via Jest globalSetup

set -e

TEST_DB_USER="${TEST_DB_USER:-test}"
TEST_DB_PASSWORD="${TEST_DB_PASSWORD:-test}"
TEST_DB_NAME="${TEST_DB_NAME:-varsityhub_test}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGTEST_ADMIN_USER:-postgres}"
# PGPASSWORD: set if admin user requires password for psql
export PGHOST PGPORT PGUSER
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATABASE_URL="postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${PGHOST}:${PGPORT}/${TEST_DB_NAME}"
export DATABASE_URL

cd "$SERVER_ROOT"

echo "[setup-test-db] Creating PostgreSQL user and database if needed..."

# Create user if not exists, then database if not exists
# Use postgres database for admin commands
psql -v ON_ERROR_STOP=1 -d postgres -tAc "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TEST_DB_USER}') THEN
      CREATE ROLE ${TEST_DB_USER} WITH LOGIN PASSWORD '${TEST_DB_PASSWORD}';
      RAISE NOTICE 'Created user ${TEST_DB_USER}';
    END IF;
  END
  \$\$;
"

psql -v ON_ERROR_STOP=1 -d postgres -tAc "
  SELECT 1 FROM pg_database WHERE datname = '${TEST_DB_NAME}'
" | grep -q 1 || psql -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE ${TEST_DB_NAME} OWNER ${TEST_DB_USER};"

echo "[setup-test-db] Running Prisma migrations..."
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

echo "[setup-test-db] Seeding test data..."
SEED_PASSWORD="${TEST_SEED_PASSWORD:-testpassword}" DATABASE_URL="$DATABASE_URL" npx tsx prisma/seed.ts

echo "[setup-test-db] Done. Database ${TEST_DB_NAME} is ready for tests."
