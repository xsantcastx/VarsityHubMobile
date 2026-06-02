#!/usr/bin/env npx tsx
import 'dotenv/config';

/**
 * Hermetic local runtime verification for the admin ad dashboard review route.
 *
 * Scope:
 * - Non-admin is blocked from POST /ads/:id/review
 * - Allowlisted verified admin can approve and reject pending ads
 * - Flagged-banner approvals require an override reason on the dashboard path
 *
 * This script always boots its own local API with a controlled ADMIN_EMAILS
 * allowlist so it does not depend on whatever localhost server is already running.
 *
 * Usage:
 *   npm --prefix server run verify:ad-dashboard-review-flow
 */

import type { Server } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

type StepResult = {
  step: string;
  ok: boolean;
  status?: number;
  detail?: string;
};

type LoginBody = {
  access_token?: string;
  user?: {
    id?: string;
  } | null;
};

type ReviewErrorBody = {
  error?: string | null;
  moderation?: {
    status?: string | null;
  } | null;
};

const prisma = new PrismaClient();
const PASSWORD = 'TestPass123!';
const RUN_ID = Date.now();
const HOST = process.env.AD_DASHBOARD_VERIFY_HOST || '127.0.0.1';
const PORT = Number(process.env.AD_DASHBOARD_VERIFY_PORT || '4011');
const BASE_URL = `http://${HOST}:${PORT}`;
const REPORT_PATH = String(process.env.AD_DASHBOARD_VERIFY_REPORT_PATH || '').trim();
const ADMIN_EMAIL = `ad-dashboard-admin_${RUN_ID}@test.local`;

const results: StepResult[] = [];
let embeddedLocalServer: Server | null = null;

let adminId = '';
let outsiderId = '';
const adIds: string[] = [];

function record(step: string, ok: boolean, status?: number, detail?: string) {
  results.push({ step, ok, status, detail });
  const label = ok ? 'PASS' : 'FAIL';
  console.log(
    `[ad-dashboard-verify] ${label} ${step}${status ? ` (${status})` : ''}${detail ? ` - ${detail}` : ''}`
  );
}

async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; data: T | string | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  return { status: res.status, data };
}

async function ensureLocalServer() {
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_PROVIDER = 'test';
  process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  const { app } = await import('../src/testApp.js');

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, HOST, () => {
      embeddedLocalServer = server;
      resolve();
    });
    server.on('error', reject);
  });

  console.log(`[ad-dashboard-verify] Started embedded local API on ${BASE_URL}`);
}

async function shutdownEmbeddedLocalServer() {
  if (!embeddedLocalServer) return;
  const server = embeddedLocalServer;
  embeddedLocalServer = null;
  await new Promise<void>((resolve, reject) => {
    server.close(err => {
      if (err) reject(err);
      else resolve();
    });
  }).catch(() => {});
}

function requireLogin(data: LoginBody | string | null, step: string) {
  const accessToken = String((data as LoginBody | null)?.access_token || '');
  const userId = String((data as LoginBody | null)?.user?.id || '');
  if (!accessToken || !userId) {
    throw new Error(`${step}: missing login token or user id`);
  }
  return { accessToken, userId };
}

async function createUser(params: { email: string; label: string; verified: boolean }) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: params.email,
      password_hash: passwordHash,
      display_name: params.label,
      username: `${params.label}_${RUN_ID}`.slice(0, 20),
      email_verified: params.verified,
      role: 'fan',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'fan',
        onboarding_completed: true,
      },
    },
  });

  const login = await api<LoginBody>('POST', '/auth/login', {
    email: params.email,
    password: PASSWORD,
  });
  if (login.status !== 200) {
    throw new Error(`${params.label}: login failed with ${login.status}`);
  }

  return {
    ...requireLogin(login.data as LoginBody, `${params.label} login`),
    createdId: user.id,
  };
}

async function createPendingAd(overrides: Record<string, unknown> = {}) {
  const ad = await prisma.ad.create({
    data: {
      user_id: outsiderId,
      contact_name: 'Ad Owner',
      contact_email: `ad-contact-${RUN_ID}@example.com`,
      business_name: `Dashboard Review ${Date.now()}`,
      banner_url: 'https://example.com/banner.jpg',
      target_url: 'https://example.com',
      target_zip_code: '10001',
      radius: 25,
      description: 'Dashboard review verifier ad',
      status: 'pending',
      payment_status: 'pending_approval',
      ...overrides,
    } as any,
  });
  adIds.push(ad.id);
  return ad;
}

async function verifyNonAdminBlocked(outsiderToken: string) {
  const ad = await createPendingAd();
  const res = await api(
    'POST',
    `/ads/${encodeURIComponent(ad.id)}/review`,
    { action: 'approve', note: 'should fail' },
    outsiderToken
  );
  record('non-admin blocked from dashboard review', res.status === 403, res.status);
}

async function verifyApprove(adminToken: string) {
  const ad = await createPendingAd();
  const res = await api(
    'POST',
    `/ads/${encodeURIComponent(ad.id)}/review`,
    { action: 'approve', note: 'Looks good' },
    adminToken
  );
  const fresh = await prisma.ad.findUnique({
    where: { id: ad.id },
    select: { status: true, payment_status: true, admin_note: true },
  });
  record(
    'admin approves pending ad via dashboard route',
    res.status === 200 &&
      fresh?.status === 'approved' &&
      fresh?.payment_status === 'unpaid' &&
      fresh?.admin_note === 'Looks good',
    res.status
  );
}

async function verifyFlaggedOverride(adminToken: string) {
  const ad = await createPendingAd({
    business_name: `Flagged Dashboard Review ${Date.now()}`,
    banner_url: 'https://example.com/flagged.jpg',
    banner_moderation_status: 'flagged',
    banner_moderation_labels: [
      { name: 'Suggestive', parent_name: null, confidence: 88.2 },
      { name: 'Violence', parent_name: null, confidence: 72.1 },
    ],
    banner_moderation_score: 88.2,
    banner_moderation_provider: 'aws_rekognition',
    banner_moderation_error: null,
    banner_moderated_at: new Date(),
  });

  const blocked = await api<ReviewErrorBody>(
    'POST',
    `/ads/${encodeURIComponent(ad.id)}/review`,
    { action: 'approve' },
    adminToken
  );
  const afterBlocked = await prisma.ad.findUnique({
    where: { id: ad.id },
    select: { status: true },
  });
  record(
    'flagged dashboard approval requires override',
    blocked.status === 409 &&
      (blocked.data as ReviewErrorBody | null)?.error ===
        'banner_moderation_flag_requires_override' &&
      (blocked.data as ReviewErrorBody | null)?.moderation?.status === 'flagged' &&
      afterBlocked?.status === 'pending',
    blocked.status
  );

  const reason =
    'Reviewed by trust and safety team; sports action image is acceptable despite automated flag.';
  const approved = await api(
    'POST',
    `/ads/${encodeURIComponent(ad.id)}/review`,
    {
      action: 'approve',
      override_banner_flag: true,
      override_reason: reason,
    },
    adminToken
  );
  const afterApproved = await prisma.ad.findUnique({
    where: { id: ad.id },
    select: { status: true, admin_note: true },
  });
  record(
    'flagged dashboard approval succeeds with override',
    approved.status === 200 &&
      afterApproved?.status === 'approved' &&
      String(afterApproved?.admin_note || '').includes(reason),
    approved.status
  );
}

async function verifyReject(adminToken: string) {
  const ad = await createPendingAd();
  const reason = 'Inappropriate content';
  const res = await api(
    'POST',
    `/ads/${encodeURIComponent(ad.id)}/review`,
    { action: 'reject', note: reason },
    adminToken
  );
  const fresh = await prisma.ad.findUnique({
    where: { id: ad.id },
    select: { status: true, payment_status: true, admin_note: true },
  });
  record(
    'admin rejects pending ad via dashboard route',
    res.status === 200 &&
      fresh?.status === 'draft' &&
      fresh?.payment_status === 'unpaid' &&
      fresh?.admin_note === reason,
    res.status
  );
}

async function cleanup() {
  if (adIds.length > 0) {
    await prisma.adReservation.deleteMany({ where: { ad_id: { in: adIds } } }).catch(() => {});
    await prisma.ad.deleteMany({ where: { id: { in: adIds } } }).catch(() => {});
  }
  const userIds = [adminId, outsiderId].filter(Boolean);
  await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
}

async function writeReport() {
  const payload = {
    ok: results.every(result => result.ok),
    baseUrl: BASE_URL,
    ranAt: new Date().toISOString(),
    results,
  };

  if (REPORT_PATH) {
    await writeFile(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`[ad-dashboard-verify] Wrote report to ${REPORT_PATH}`);
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  try {
    await ensureLocalServer();
    const admin = await createUser({
      email: ADMIN_EMAIL,
      label: 'ad_dashboard_admin',
      verified: true,
    });
    adminId = admin.userId;
    const outsider = await createUser({
      email: `ad-dashboard-outsider_${RUN_ID}@test.local`,
      label: 'ad_dashboard_outsider',
      verified: true,
    });
    outsiderId = outsider.userId;

    await verifyNonAdminBlocked(outsider.accessToken);
    await verifyApprove(admin.accessToken);
    await verifyFlaggedOverride(admin.accessToken);
    await verifyReject(admin.accessToken);
    await writeReport();
    return results.every(result => result.ok) ? 0 : 1;
  } finally {
    await cleanup().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    await shutdownEmbeddedLocalServer().catch(() => {});
  }
}

main()
  .catch(async error => {
    record('fatal', false, undefined, error instanceof Error ? error.message : String(error));
    await writeReport().catch(() => {});
    await cleanup().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    await shutdownEmbeddedLocalServer().catch(() => {});
    console.error('[ad-dashboard-verify] fatal:', error);
    process.exit(1);
  })
  .then(code => {
    if (typeof code === 'number') {
      process.exit(code);
    }
  });
