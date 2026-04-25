/**
 * Event cancel permission tests.
 *
 * Locks in the broadened cancel policy at events.ts:/cancel:
 *   - event creator CAN cancel (regardless of team affiliation)
 *   - team staff (owner/manager/coach/assistant_coach) CAN cancel
 *   - org admin (owner/manager) CAN cancel even without team membership
 *   - platform admin CAN cancel
 *   - non-affiliated user CANNOT cancel (403)
 *
 * Previously the cancel handler only accepted team owner role and skipped
 * the org-admin fallback, which left league owners locked out of events in
 * their own league. This test pins the corrected behavior so a future
 * regression flips back loudly.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

// Stable per-suite suffix for fixture uniqueness. Using randomUUID instead
// of Date.now() so two runs at the same millisecond don't hit a unique-
// constraint collision (older pattern was email = `${prefix}-${Date.now()}`).
const ts = randomUUID();
const PASSWORD = 'TestPassword123!';

// Fixed UTC future date — far enough out that nothing in the test relies on
// "now". Was `Date.now() + 7 days` which is fine for relative-future-ness
// but adds spurious cross-run variance.
const FUTURE_EVENT_DATE = new Date('2099-01-01T12:00:00Z');

describe('Event Cancel Permissions', () => {
  let orgId: string;
  let teamId: string;
  let creatorId: string;
  let creatorToken: string;
  let teamCoachId: string;
  let teamCoachToken: string;
  let orgManagerId: string;
  let orgManagerToken: string;
  let strangerId: string;
  let strangerToken: string;

  async function makeUser(emailPrefix: string, prefs: Record<string, unknown>) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const prefsRole = (prefs as any)?.role;
    const role = prefsRole === 'coach' || prefsRole === 'fan' ? prefsRole : undefined;
    return prisma.user.create({
      data: {
        email: `${emailPrefix}-${ts}-${randomUUID()}@example.com`,
        password_hash: hash,
        display_name: emailPrefix,
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01'),
        ...(role ? { role } : {}),
        onboarding_completed: true,
        preferences: { onboarding_completed: true, ...prefs },
      },
    });
  }

  async function createCancellableEvent(label: string) {
    return prisma.event.create({
      data: {
        title: `${label} ${ts}-${randomUUID()}`,
        date: FUTURE_EVENT_DATE,
        team_id: teamId,
        status: 'approved',
        approval_status: 'approved',
        creator_id: creatorId,
        creator_role: 'fan',
      } as any,
    });
  }

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const org = await prisma.organization.create({
      data: {
        name: `Cancel Permission League ${ts}`,
        org_type: 'league',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const team = await prisma.team.create({
      data: { name: `Cancel Permission Team ${ts}`, organization_id: orgId },
    });
    teamId = team.id;

    const creator = await makeUser('cancel-creator', { role: 'fan' });
    creatorId = creator.id;
    creatorToken = signJwt({ id: creatorId });

    const coach = await makeUser('cancel-coach', {
      role: 'coach',
      plan: 'rookie',
      coach_agreement_accepted_at: new Date().toISOString(),
    });
    teamCoachId = coach.id;
    teamCoachToken = signJwt({ id: teamCoachId });
    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: teamCoachId, role: 'coach', status: 'active' },
    });

    const manager = await makeUser('cancel-orgmgr', {
      role: 'coach',
      plan: 'rookie',
      coach_agreement_accepted_at: new Date().toISOString(),
    });
    orgManagerId = manager.id;
    orgManagerToken = signJwt({ id: orgManagerId });
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: orgManagerId, role: 'manager', status: 'active' },
    });

    const stranger = await makeUser('cancel-stranger', { role: 'fan' });
    strangerId = stranger.id;
    strangerToken = signJwt({ id: strangerId });
  });

  afterAll(async () => {
    const userIds = [creatorId, teamCoachId, orgManagerId, strangerId].filter(Boolean);
    await prisma.eventRsvp.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
    await prisma.event.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  });

  it('creator can cancel their own event', async () => {
    const event = await createCancellableEvent('creator-cancel');
    const res = await request(app)
      .patch(`/events/${event.id}/cancel`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send();
    expect(res.status).toBe(200);
    const after = await prisma.event.findUnique({ where: { id: event.id } });
    expect(after?.status).toBe('cancelled');
  });

  it('team coach can cancel an event on their team', async () => {
    const event = await createCancellableEvent('coach-cancel');
    const res = await request(app)
      .patch(`/events/${event.id}/cancel`)
      .set('Authorization', `Bearer ${teamCoachToken}`)
      .send();
    expect(res.status).toBe(200);
    const after = await prisma.event.findUnique({ where: { id: event.id } });
    expect(after?.status).toBe('cancelled');
  });

  it('org manager can cancel an event for a team in their org without direct team membership', async () => {
    const event = await createCancellableEvent('orgmgr-cancel');
    const res = await request(app)
      .patch(`/events/${event.id}/cancel`)
      .set('Authorization', `Bearer ${orgManagerToken}`)
      .send();
    expect(res.status).toBe(200);
    const after = await prisma.event.findUnique({ where: { id: event.id } });
    expect(after?.status).toBe('cancelled');
  });

  it('non-affiliated stranger cannot cancel', async () => {
    const event = await createCancellableEvent('stranger-cancel');
    const res = await request(app)
      .patch(`/events/${event.id}/cancel`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send();
    expect(res.status).toBe(403);
    const after = await prisma.event.findUnique({ where: { id: event.id } });
    expect(after?.status).not.toBe('cancelled');
  });
});
