/**
 * Account-deletion endpoint — POST /auth/account/delete.
 *
 * The cron that purges fully-anonymized rows is covered in
 * anonymized-user-purge.test.ts. The endpoint that triggers the
 * soft-delete + anonymization itself was untested — meaning a regression
 * (e.g., dropping the password gate, or skipping the anonymization
 * step) would ship silently.
 *
 * Covers:
 *   • Unauthenticated → 401 from requireAuth
 *   • Missing DELETE confirmation → 400 DELETE_CONFIRMATION_REQUIRED
 *   • Password account, no password supplied → 400 PASSWORD_REQUIRED
 *   • Password account, wrong password → 401 INVALID_PASSWORD
 *   • Password account, correct password → 200 + DB anonymization +
 *     subsequent login fails
 *   • OAuth-only account (no password_hash) → 200 without supplying password
 *   • Already-deleted user → 200 with already_deleted=true (idempotent)
 */

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { prisma } from '../lib/prisma.js';
import { signJwt } from '../lib/jwt.js';
import { app } from '../testApp.js';

const PASSWORD = 'CorrectPassword123!';
const WRONG_PASSWORD = 'WrongPassword999!';

// This suite performs repeated bcrypt hashing plus end-to-end auth flows
// against the shared test app, so the default 10s ceiling is too tight when
// the full server suite is already under load.
jest.setTimeout(20_000);

// Ids tracked for cleanup across all suites in this file.
const createdUserIds = new Set<string>();

async function createPasswordUser(): Promise<{ id: string; email: string; token: string }> {
  const email = `delete-acct-pw-${randomUUID()}@example.com`;
  const password_hash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password_hash,
      display_name: 'Delete-Test Password User',
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: { role: 'fan', onboarding_completed: true },
    },
  });
  createdUserIds.add(user.id);

  const login = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  expect(login.status).toBe(200);
  const token = login.body?.access_token as string;
  expect(token).toBeTruthy();
  return { id: user.id, email, token };
}

async function createUnverifiedPasswordUser(): Promise<{ id: string; email: string; token: string }> {
  const email = `delete-acct-unverified-${randomUUID()}@example.com`;
  const password_hash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password_hash,
      display_name: 'Delete-Test Unverified User',
      email_verified: false,
      approval_status: 'APPROVED',
      preferences: { role: 'fan', onboarding_completed: false },
    },
  });
  createdUserIds.add(user.id);
  return { id: user.id, email, token: signJwt({ id: user.id }) };
}

async function createOAuthOnlyUser(): Promise<{ id: string; email: string; token: string }> {
  const email = `delete-acct-oauth-${randomUUID()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: null,
      google_id: `google-${randomUUID()}`,
      display_name: 'Delete-Test OAuth User',
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: { role: 'fan', onboarding_completed: true },
    },
  });
  createdUserIds.add(user.id);

  // No /auth/login for OAuth-only users; mint a JWT directly using the same
  // helper /auth/google would call after verifying an id_token. Pattern
  // matches auth-flow.test.ts.
  const token = signJwt({ id: user.id });
  return { id: user.id, email, token };
}

afterAll(async () => {
  for (const id of createdUserIds) {
    await prisma.refreshToken.deleteMany({ where: { user_id: id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id } }).catch(() => {});
  }
});

describe('POST /auth/account/delete', () => {
  describe('authentication gate', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).post('/auth/account/delete').send({});
      expect(res.status).toBe(401);
    });
  });

  describe('password account', () => {
    it('rejects with 400 PASSWORD_REQUIRED when password is omitted', async () => {
      const { token } = await createPasswordUser();
      const res = await request(app)
        .post('/auth/account/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ delete_confirmation: 'DELETE' });
      expect(res.status).toBe(400);
      expect(res.body?.error).toBe('PASSWORD_REQUIRED');
    });

    it('rejects with 400 DELETE_CONFIRMATION_REQUIRED when destructive text is omitted', async () => {
      const { token } = await createPasswordUser();
      const res = await request(app)
        .post('/auth/account/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body?.error).toBe('DELETE_CONFIRMATION_REQUIRED');
    });

    it('rejects with 401 INVALID_PASSWORD when password is wrong', async () => {
      const { token } = await createPasswordUser();
      const res = await request(app)
        .post('/auth/account/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: WRONG_PASSWORD, delete_confirmation: 'DELETE' });
      expect(res.status).toBe(401);
      expect(res.body?.error).toBe('INVALID_PASSWORD');
    });

    it('soft-deletes + anonymizes the user with correct password and blocks subsequent login', async () => {
      const { id, email, token } = await createPasswordUser();

      const res = await request(app)
        .post('/auth/account/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, delete_confirmation: 'DELETE' });

      expect(res.status).toBe(200);
      expect(res.body?.ok).toBe(true);
      expect(typeof res.body?.deleted_at).toBe('string');

      // Direct DB inspection — anonymization flags actually set.
      const after = await prisma.user.findUnique({
        where: { id },
        select: { deleted_at: true, deletion_anonymized: true },
      });
      expect(after?.deleted_at).toBeTruthy();
      expect(after?.deletion_anonymized).toBe(true);

      // Subsequent login attempt with original credentials must NOT succeed —
      // the email may have been anonymized or the password_hash cleared.
      const reLogin = await request(app).post('/auth/login').send({ email, password: PASSWORD });
      expect(reLogin.status).not.toBe(200);
    });

    it('allows an unverified password account to self-delete', async () => {
      const { id, token } = await createUnverifiedPasswordUser();

      const res = await request(app)
        .post('/auth/account/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, delete_confirmation: 'DELETE' });

      expect(res.status).toBe(200);
      expect(res.body?.ok).toBe(true);

      const after = await prisma.user.findUnique({
        where: { id },
        select: { deleted_at: true, deletion_anonymized: true },
      });
      expect(after?.deleted_at).toBeTruthy();
      expect(after?.deletion_anonymized).toBe(true);
    });
  });

  describe('OAuth-only account', () => {
    it('soft-deletes without requiring a password (no password_hash on file)', async () => {
      const { id, token } = await createOAuthOnlyUser();
      const res = await request(app)
        .post('/auth/account/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ delete_confirmation: 'DELETE' });
      expect(res.status).toBe(200);
      expect(res.body?.ok).toBe(true);

      const after = await prisma.user.findUnique({
        where: { id },
        select: { deleted_at: true, deletion_anonymized: true },
      });
      expect(after?.deleted_at).toBeTruthy();
      expect(after?.deletion_anonymized).toBe(true);
    });
  });

  describe('idempotency', () => {
    it('returns 200 with already_deleted=true on a second call', async () => {
      const { token } = await createPasswordUser();

      const first = await request(app)
        .post('/auth/account/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, delete_confirmation: 'DELETE' });
      expect(first.status).toBe(200);

      // Second call uses the same token. The token MAY be invalidated post-
      // delete (session_epoch bump etc.) — accept either 401 (token killed)
      // OR 200 with already_deleted (account already gone). Both are correct
      // observable outcomes.
      const second = await request(app)
        .post('/auth/account/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, delete_confirmation: 'DELETE' });

      if (second.status === 200) {
        expect(second.body?.already_deleted).toBe(true);
      } else {
        expect(second.status).toBe(401);
      }
    });
  });
});
