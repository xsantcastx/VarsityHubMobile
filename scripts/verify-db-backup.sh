#!/bin/bash
set -euo pipefail

BACKUP_PATH="${BACKUP_PATH:-/tmp/varsityhub-production-backup.dump}"
BACKUP_DIR="$(dirname "$BACKUP_PATH")"
mkdir -p "$BACKUP_DIR"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required but was not found in PATH" >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore is required but was not found in PATH" >&2
  exit 1
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "railway CLI is required but was not found in PATH" >&2
  exit 1
fi

echo "Creating PostgreSQL backup from the active Railway service environment..."
railway run pg_dump --format=custom --compress=9 --file "$BACKUP_PATH"

if [ ! -s "$BACKUP_PATH" ]; then
  echo "Backup file was not created successfully" >&2
  exit 1
fi

BACKUP_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH")
echo "Backup created at $BACKUP_PATH"
echo "Backup size: ${BACKUP_SIZE} bytes"

echo "Validating the archive structure..."
pg_restore --list "$BACKUP_PATH" >/dev/null

echo "Backup validation succeeded."
echo ""
RESTORE_TARGET="${RESTORE_DATABASE_URL:-<set RESTORE_DATABASE_URL to a disposable database>}"
echo "Restore command (example):"
echo "  pg_restore --clean --if-exists --no-owner --no-privileges --dbname \"$RESTORE_TARGET\" \"$BACKUP_PATH\""
echo ""
echo "If you want a fresh restore test, export RESTORE_DATABASE_URL to a disposable database first."
