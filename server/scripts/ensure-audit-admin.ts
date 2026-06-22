/**
 * Idempotent admin provisioning for cross-role-e2e-audit (LOCAL/dev only).
 * Upserts an admin user with a known bcrypt password + email_verified=true so
 * the audit can log in as admin.
 *
 * SAFETY:
 *  - Credentials are REQUIRED from env (AUDIT_ADMIN_EMAIL / AUDIT_ADMIN_PASSWORD).
 *    There is NO default password — this script can never create a known-password
 *    admin by accident.
 *  - Refuses to run unless DATABASE_URL points at a local database. This must
 *    never touch a remote/production DB (it would mint a privileged backdoor).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const EMAIL = String(process.env.AUDIT_ADMIN_EMAIL || '').trim().toLowerCase();
const PASSWORD = String(process.env.AUDIT_ADMIN_PASSWORD || '');

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL is not set.');
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal) {
    throw new Error(
      `Refusing to run against non-local DATABASE_URL (host=${host}). ` +
        'This script is local/dev only and must never provision an admin on a remote DB.'
    );
  }
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set AUDIT_ADMIN_EMAIL and AUDIT_ADMIN_PASSWORD (no defaults).');
  }
  assertLocalDatabase();

  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const username = (EMAIL.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'audit_admin').slice(0, 20);
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { password_hash: hash, email_verified: true, approval_status: 'APPROVED' },
      create: {
        email: EMAIL,
        password_hash: hash,
        display_name: 'Audit Admin',
        username,
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'coach', onboarding_completed: true, plan: 'legend', is_admin: true },
      },
    });
    console.log(`Provisioned admin: ${user.email} (id=${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
