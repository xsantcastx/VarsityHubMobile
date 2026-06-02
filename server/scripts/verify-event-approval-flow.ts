#!/usr/bin/env npx tsx
/**
 * Local runtime verification for the event-approvals screen contract.
 *
 * Scope:
 * - Org manager can see pending events and pending games for managed teams.
 * - Unscoped fan cannot approve either surface.
 * - Org manager can approve/reject both surfaces and the DB settles correctly.
 *
 * This script mutates local data and is intended for localhost only.
 *
 * Usage:
 *   npm --prefix server run verify:event-approval-flow
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

type EventListItem = {
  id?: string | null;
  approval_status?: string | null;
  rejected_reason?: string | null;
};

type GameListBody = {
  games?: Array<{
    id?: string | null;
    approval_status?: string | null;
  }> | null;
};

const prisma = new PrismaClient();
const BASE_URL = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const REPORT_PATH = String(process.env.EVENT_APPROVAL_VERIFY_REPORT_PATH || '').trim();
const PASSWORD = 'TestPass123!';
const RUN_ID = Date.now();

const results: StepResult[] = [];
let embeddedLocalServer: Server | null = null;

let managerId = '';
let submitterId = '';
let outsiderId = '';
let orgId = '';
let teamId = '';

function record(step: string, ok: boolean, status?: number, detail?: string) {
  results.push({ step, ok, status, detail });
  const label = ok ? 'PASS' : 'FAIL';
  console.log(
    `[event-approval-verify] ${label} ${step}${status ? ` (${status})` : ''}${detail ? ` - ${detail}` : ''}`
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
    throw new Error('verify-event-approval-flow is local-only. Set BASE_URL to localhost.');
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
    `[event-approval-verify] Started embedded local API on ${hostname}:${port} for localhost verification.`
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

async function createApprovedUser(params: {
  label: string;
  role: 'coach' | 'fan';
  displayName: string;
}) {
  const email = `${params.label}_${RUN_ID}@test.local`;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      display_name: params.displayName,
      username: `${params.label}_${RUN_ID}`.slice(0, 20),
      email_verified: true,
      role: params.role,
      onboarding_completed: true,
      approval_status: 'APPROVED',
      preferences: {
        role: params.role,
        onboarding_completed: true,
        ...(params.role === 'coach'
          ? {
              plan: 'rookie',
              coach_agreement_accepted_at: new Date().toISOString(),
            }
          : {}),
      },
    },
  });

  const login = await api<LoginBody>('POST', '/auth/login', { email, password: PASSWORD });
  if (login.status !== 200) {
    throw new Error(`${params.label}: login failed with ${login.status}`);
  }

  return {
    email,
    ...requireLogin(login.data as LoginBody, `${params.label} login`),
    createdId: user.id,
  };
}

async function setupFixtures() {
  const manager = await createApprovedUser({
    label: 'approval_manager',
    role: 'coach',
    displayName: 'Approval Manager',
  });
  managerId = manager.userId;

  const submitter = await createApprovedUser({
    label: 'approval_submitter',
    role: 'fan',
    displayName: 'Approval Submitter',
  });
  submitterId = submitter.userId;

  const outsider = await createApprovedUser({
    label: 'approval_outsider',
    role: 'fan',
    displayName: 'Approval Outsider',
  });
  outsiderId = outsider.userId;

  const org = await prisma.organization.create({
    data: {
      name: `Approval Verify Org ${RUN_ID}`,
      org_type: 'club',
      admin_approved: true,
      updated_at: new Date(),
    },
  });
  orgId = org.id;

  const team = await prisma.team.create({
    data: {
      name: `Approval Verify Team ${RUN_ID}`,
      organization_id: orgId,
      sport: 'basketball',
    },
  });
  teamId = team.id;

  await prisma.organizationMembership.create({
    data: {
      organization_id: orgId,
      user_id: managerId,
      role: 'manager',
      status: 'active',
    },
  });

  return {
    managerToken: manager.accessToken,
    outsiderToken: outsider.accessToken,
  };
}

async function verifyEventFlow(managerToken: string, outsiderToken: string) {
  const pendingEvent = await prisma.event.create({
    data: {
      title: `Pending Event ${RUN_ID}`,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      location: 'Approval Verify Gym',
      team_id: teamId,
      creator_id: submitterId,
      creator_role: 'fan',
      status: 'draft',
      approval_status: 'pending',
    } as any,
  });

  const managerPendingBefore = await api<EventListItem[]>(
    'GET',
    '/events/pending',
    undefined,
    managerToken
  );
  const visibleBefore =
    managerPendingBefore.status === 200 &&
    Array.isArray(managerPendingBefore.data) &&
    managerPendingBefore.data.some(event => event?.id === pendingEvent.id);
  record('manager sees pending event', visibleBefore, managerPendingBefore.status);

  const outsiderPending = await api('GET', '/events/pending', undefined, outsiderToken);
  record('outsider blocked from pending events', outsiderPending.status === 403, outsiderPending.status);

  const outsiderApprove = await api(
    'PUT',
    `/events/${encodeURIComponent(pendingEvent.id)}/approve`,
    {},
    outsiderToken
  );
  record('outsider blocked from event approve', outsiderApprove.status === 403, outsiderApprove.status);

  const approve = await api<EventListItem>(
    'PUT',
    `/events/${encodeURIComponent(pendingEvent.id)}/approve`,
    {},
    managerToken
  );
  const approvedEvent = await prisma.event.findUnique({
    where: { id: pendingEvent.id },
    select: { approval_status: true, status: true, approved_at: true },
  });
  record(
    'manager approves event',
    approve.status === 200 &&
      approve.data &&
      (approve.data as EventListItem).approval_status === 'approved' &&
      approvedEvent?.approval_status === 'approved' &&
      approvedEvent?.status === 'approved' &&
      Boolean(approvedEvent?.approved_at),
    approve.status
  );

  const managerPendingAfterApprove = await api<EventListItem[]>(
    'GET',
    '/events/pending',
    undefined,
    managerToken
  );
  const absentAfterApprove =
    managerPendingAfterApprove.status === 200 &&
    Array.isArray(managerPendingAfterApprove.data) &&
    !managerPendingAfterApprove.data.some(event => event?.id === pendingEvent.id);
  record(
    'approved event drops from pending list',
    absentAfterApprove,
    managerPendingAfterApprove.status
  );

  const rejectedEvent = await prisma.event.create({
    data: {
      title: `Rejected Event ${RUN_ID}`,
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      location: 'Approval Verify Field',
      team_id: teamId,
      creator_id: submitterId,
      creator_role: 'fan',
      status: 'draft',
      approval_status: 'pending',
    } as any,
  });

  const rejectReason = 'Missing details';
  const reject = await api<EventListItem>(
    'PUT',
    `/events/${encodeURIComponent(rejectedEvent.id)}/reject`,
    { reason: rejectReason },
    managerToken
  );
  const rejectedEventAfter = await prisma.event.findUnique({
    where: { id: rejectedEvent.id },
    select: { approval_status: true, status: true, rejected_reason: true },
  });
  record(
    'manager rejects event',
    reject.status === 200 &&
      reject.data &&
      (reject.data as EventListItem).approval_status === 'rejected' &&
      rejectedEventAfter?.approval_status === 'rejected' &&
      rejectedEventAfter?.status === 'rejected' &&
      rejectedEventAfter?.rejected_reason === rejectReason,
    reject.status
  );
}

async function verifyGameFlow(managerToken: string, outsiderToken: string) {
  const pendingGame = await (prisma.game.create as any)({
    data: {
      title: `Pending Game ${RUN_ID}`,
      date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      location: 'Approval Verify Arena',
      home_team_id: teamId,
      created_by_id: submitterId,
      approval_status: 'pending',
    },
  });

  const linkedApproveEvent = await prisma.event.create({
    data: {
      title: `Pending Game Event ${RUN_ID}`,
      date: pendingGame.date,
      location: pendingGame.location,
      team_id: teamId,
      game_id: pendingGame.id,
      creator_id: submitterId,
      creator_role: 'fan',
      status: 'draft',
      approval_status: 'pending',
    } as any,
  });

  const managerPendingBefore = await api<GameListBody>(
    'GET',
    '/games?show_pending=true&limit=50',
    undefined,
    managerToken
  );
  const gameVisibleBefore =
    managerPendingBefore.status === 200 &&
    Array.isArray((managerPendingBefore.data as GameListBody | null)?.games) &&
    ((managerPendingBefore.data as GameListBody).games || []).some(game => game?.id === pendingGame.id);
  record('manager sees pending game', gameVisibleBefore, managerPendingBefore.status);

  const outsiderApprove = await api(
    'PUT',
    `/games/${encodeURIComponent(pendingGame.id)}/approve`,
    { approval_status: 'approved' },
    outsiderToken
  );
  record('outsider blocked from game approve', outsiderApprove.status === 403, outsiderApprove.status);

  const approve = await api(
    'PUT',
    `/games/${encodeURIComponent(pendingGame.id)}/approve`,
    { approval_status: 'approved' },
    managerToken
  );
  const approvedGame = await (prisma.game.findUnique as any)({
    where: { id: pendingGame.id },
    select: { approval_status: true, approved_at: true, approved_by_id: true },
  });
  const linkedApproveEventAfter = await prisma.event.findUnique({
    where: { id: linkedApproveEvent.id },
    select: { approval_status: true, status: true, approved_at: true },
  });
  record(
    'manager approves game',
    approve.status === 200 &&
      approvedGame?.approval_status === 'approved' &&
      approvedGame?.approved_by_id === managerId &&
      Boolean(approvedGame?.approved_at) &&
      linkedApproveEventAfter?.approval_status === 'approved' &&
      linkedApproveEventAfter?.status === 'approved' &&
      Boolean(linkedApproveEventAfter?.approved_at),
    approve.status
  );

  const managerPendingAfterApprove = await api<GameListBody>(
    'GET',
    '/games?show_pending=true&limit=50',
    undefined,
    managerToken
  );
  const gameAbsentAfterApprove =
    managerPendingAfterApprove.status === 200 &&
    Array.isArray((managerPendingAfterApprove.data as GameListBody | null)?.games) &&
    !((managerPendingAfterApprove.data as GameListBody).games || []).some(
      game => game?.id === pendingGame.id
    );
  record(
    'approved game drops from pending list',
    gameAbsentAfterApprove,
    managerPendingAfterApprove.status
  );

  const rejectedGame = await (prisma.game.create as any)({
    data: {
      title: `Rejected Game ${RUN_ID}`,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      location: 'Approval Verify Court',
      home_team_id: teamId,
      created_by_id: submitterId,
      approval_status: 'pending',
    },
  });

  const linkedRejectEvent = await prisma.event.create({
    data: {
      title: `Rejected Game Event ${RUN_ID}`,
      date: rejectedGame.date,
      location: rejectedGame.location,
      team_id: teamId,
      game_id: rejectedGame.id,
      creator_id: submitterId,
      creator_role: 'fan',
      status: 'draft',
      approval_status: 'pending',
    } as any,
  });

  const rejectReason = 'Schedule conflict';
  const reject = await api(
    'PUT',
    `/games/${encodeURIComponent(rejectedGame.id)}/approve`,
    { approval_status: 'rejected', reason: rejectReason },
    managerToken
  );
  const rejectedGameAfter = await (prisma.game.findUnique as any)({
    where: { id: rejectedGame.id },
    select: { approval_status: true, approved_at: true, approved_by_id: true },
  });
  const linkedRejectEventAfter = await prisma.event.findUnique({
    where: { id: linkedRejectEvent.id },
    select: { approval_status: true, status: true, rejected_reason: true },
  });
  record(
    'manager rejects game',
    reject.status === 200 &&
      rejectedGameAfter?.approval_status === 'rejected' &&
      rejectedGameAfter?.approved_by_id === null &&
      linkedRejectEventAfter?.approval_status === 'rejected' &&
      linkedRejectEventAfter?.status === 'rejected' &&
      linkedRejectEventAfter?.rejected_reason === rejectReason,
    reject.status
  );
}

async function cleanup() {
  const userIds = [managerId, submitterId, outsiderId].filter(Boolean);
  await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
  await prisma.event.deleteMany({
    where: {
      OR: [
        { creator_id: submitterId || '__none__' },
        { team_id: teamId || '__none__' },
      ],
    },
  }).catch(() => {});
  await prisma.game.deleteMany({
    where: {
      OR: [
        { created_by_id: submitterId || '__none__' },
        { home_team_id: teamId || '__none__' },
      ],
    },
  }).catch(() => {});
  if (teamId) {
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
  }
  if (orgId) {
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  }
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
    console.log(`[event-approval-verify] Wrote report to ${REPORT_PATH}`);
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  try {
    await ensureLocalServer();
    const { managerToken, outsiderToken } = await setupFixtures();
    await verifyEventFlow(managerToken, outsiderToken);
    await verifyGameFlow(managerToken, outsiderToken);
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
    console.error('[event-approval-verify] fatal:', error);
    process.exit(1);
  })
  .then(code => {
    if (typeof code === 'number') {
      process.exit(code);
    }
  });
