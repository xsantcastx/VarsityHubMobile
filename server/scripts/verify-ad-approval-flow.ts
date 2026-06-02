#!/usr/bin/env npx tsx
import 'dotenv/config';

/**
 * Local runtime verification for the ad approval flow.
 *
 * Scope:
 * - Advertiser can submit a draft ad for approval.
 * - A non-owner cannot submit someone else's draft ad.
 * - Tokenized moderation approve/reject paths settle DB state correctly.
 *
 * This script mutates local data and is intended for localhost only.
 *
 * Usage:
 *   npm --prefix server run verify:ad-approval-flow
 */

import type { Server } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { signReviewToken } from '../src/lib/reviewTokens.js';

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

type AdBody = {
  id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  admin_note?: string | null;
};

const prisma = new PrismaClient();
const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const REPORT_PATH = String(process.env.AD_APPROVAL_VERIFY_REPORT_PATH || '').trim();
const PASSWORD = 'TestPass123!';
const RUN_ID = Date.now();

const results: StepResult[] = [];
let embeddedLocalServer: Server | null = null;

let ownerId = '';
let outsiderId = '';
const adIds: string[] = [];

function record(step: string, ok: boolean, status?: number, detail?: string) {
  results.push({ step, ok, status, detail });
  const label = ok ? 'PASS' : 'FAIL';
  console.log(
    `[ad-approval-verify] ${label} ${step}${status ? ` (${status})` : ''}${detail ? ` - ${detail}` : ''}`
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

function isLocalBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function getBaseUrlAddress(url: string): { hostname: string; port: number } {
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80,
  };
}

async function isBaseUrlReachable(url: string): Promise<boolean> {
  try {
    await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    return true;
  } catch {
    return false;
  }
}

async function ensureLocalServer() {
  if (!isLocalBaseUrl(BASE_URL)) {
    throw new Error('verify-ad-approval-flow is local-only. Set BASE_URL to localhost.');
  }
  if (await isBaseUrlReachable(BASE_URL)) return;

  const { hostname, port } = getBaseUrlAddress(BASE_URL);
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_PROVIDER = 'test';
  const { app } = await import('../src/testApp.js');

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(port, hostname, () => {
      embeddedLocalServer = server;
      resolve();
    });
    server.on('error', reject);
  });

  console.log(
    `[ad-approval-verify] Started embedded local API on ${hostname}:${port} for localhost verification.`
  );
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

async function createVerifiedFan(label: string) {
  const email = `${label}_${RUN_ID}@test.local`;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      display_name: label,
      username: `${label}_${RUN_ID}`.slice(0, 20),
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'fan',
        onboarding_completed: true,
      },
    },
  });

  const login = await api<LoginBody>('POST', '/auth/login', { email, password: PASSWORD });
  if (login.status !== 200) {
    throw new Error(`${label}: login failed with ${login.status}`);
  }

  return {
    email,
    ...requireLogin(login.data as LoginBody, `${label} login`),
    createdId: user.id,
  };
}

async function createDraftAd(ownerEmail: string) {
  const ad = await prisma.ad.create({
    data: {
      user_id: ownerId,
      contact_name: 'Ad Owner',
      contact_email: ownerEmail,
      business_name: `Verify Ad ${Date.now()}`,
      banner_url: null,
      target_url: 'https://example.com',
      target_zip_code: '10001',
      radius: 25,
      description: 'Local approval verifier ad',
      status: 'draft',
      payment_status: 'unpaid',
    },
  });
  adIds.push(ad.id);
  return ad;
}

async function verifySubmitForApproval(ownerToken: string, ownerEmail: string, outsiderToken: string) {
  const blockedAd = await createDraftAd(ownerEmail);
  const outsiderSubmit = await api<AdBody>(
    'POST',
    `/ads/${encodeURIComponent(blockedAd.id)}/submit-for-approval`,
    {},
    outsiderToken
  );
  record('outsider blocked from submit-for-approval', outsiderSubmit.status === 403, outsiderSubmit.status);

  const approvedAd = await createDraftAd(ownerEmail);
  const ownerSubmit = await api<AdBody>(
    'POST',
    `/ads/${encodeURIComponent(approvedAd.id)}/submit-for-approval`,
    {},
    ownerToken
  );
  const approvedAdAfterSubmit = await prisma.ad.findUnique({
    where: { id: approvedAd.id },
    select: { status: true, payment_status: true },
  });
  record(
    'owner submits ad for approval',
    ownerSubmit.status === 200 &&
      (ownerSubmit.data as AdBody | null)?.status === 'pending' &&
      approvedAdAfterSubmit?.status === 'pending' &&
      approvedAdAfterSubmit?.payment_status === 'pending_approval',
    ownerSubmit.status
  );

  const approveToken = signReviewToken({
    adId: approvedAd.id,
    action: 'approve_ad',
  });
  const approve = await api<string>(
    'POST',
    `/ads/${encodeURIComponent(approvedAd.id)}/approve?token=${encodeURIComponent(approveToken)}`,
    {}
  );
  const approvedAdAfterReview = await prisma.ad.findUnique({
    where: { id: approvedAd.id },
    select: { status: true, payment_status: true },
  });
  record(
    'token approve settles ad',
    approve.status === 200 &&
      typeof approve.data === 'string' &&
      approve.data.includes('Ad Approved') &&
      approvedAdAfterReview?.status === 'approved' &&
      approvedAdAfterReview?.payment_status === 'unpaid',
    approve.status
  );
}

async function verifyReject(ownerToken: string, ownerEmail: string) {
  const rejectedAd = await createDraftAd(ownerEmail);
  const ownerSubmit = await api<AdBody>(
    'POST',
    `/ads/${encodeURIComponent(rejectedAd.id)}/submit-for-approval`,
    {},
    ownerToken
  );
  record('owner submits reject-path ad for approval', ownerSubmit.status === 200, ownerSubmit.status);

  const rejectToken = signReviewToken({
    adId: rejectedAd.id,
    action: 'reject_ad',
  });
  const rejectReason = 'Needs clearer creative';
  const reject = await api<string>(
    'POST',
    `/ads/${encodeURIComponent(rejectedAd.id)}/reject?token=${encodeURIComponent(rejectToken)}`,
    { reason: rejectReason }
  );
  const rejectedAdAfterReview = await prisma.ad.findUnique({
    where: { id: rejectedAd.id },
    select: { status: true, payment_status: true, admin_note: true },
  });
  record(
    'token reject settles ad',
    reject.status === 200 &&
      typeof reject.data === 'string' &&
      reject.data.includes('Ad Rejected') &&
      rejectedAdAfterReview?.status === 'draft' &&
      rejectedAdAfterReview?.payment_status === 'unpaid' &&
      rejectedAdAfterReview?.admin_note === rejectReason,
    reject.status
  );
}

async function cleanup() {
  if (adIds.length > 0) {
    await prisma.adReservation.deleteMany({ where: { ad_id: { in: adIds } } }).catch(() => {});
    await prisma.ad.deleteMany({ where: { id: { in: adIds } } }).catch(() => {});
  }
  const userIds = [ownerId, outsiderId].filter(Boolean);
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
    console.log(`[ad-approval-verify] Wrote report to ${REPORT_PATH}`);
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  try {
    await ensureLocalServer();
    const owner = await createVerifiedFan('ad_owner');
    ownerId = owner.userId;
    const outsider = await createVerifiedFan('ad_outsider');
    outsiderId = outsider.userId;

    await verifySubmitForApproval(owner.accessToken, owner.email, outsider.accessToken);
    await verifyReject(owner.accessToken, owner.email);
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
    console.error('[ad-approval-verify] fatal:', error);
    process.exit(1);
  })
  .then(code => {
    if (typeof code === 'number') {
      process.exit(code);
    }
  });
