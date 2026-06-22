#!/usr/bin/env npx tsx
/**
 * Seed a dedicated auth-canary account for local lifecycle verification.
 * Mirrors the appReviewFixture pattern: bcrypt-hashed password, email_verified.
 * Idempotent upsert keyed on email. LOCAL/dev use only.
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.AUTH_CANARY_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.AUTH_CANARY_PASSWORD || '');
  if (!email || !password) {
    throw new Error('Set AUTH_CANARY_EMAIL and AUTH_CANARY_PASSWORD');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const username = email.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'canary';

  const user = await prisma.user.upsert({
    where: { email },
    update: { password_hash, email_verified: true },
    create: {
      email,
      password_hash,
      email_verified: true,
      display_name: 'Auth Canary',
      username,
    },
    select: { id: true, email: true, email_verified: true },
  });

  console.log('[seed-auth-canary] ready:', JSON.stringify(user));
}

main()
  .catch((e) => {
    console.error('[seed-auth-canary] failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
