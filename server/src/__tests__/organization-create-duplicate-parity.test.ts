/**
 * Both org-create routes must mirror the DB's duplicate-name constraint.
 *
 * The database has two partial unique indexes on active organizations
 * (migration 20260429224500) using normalize_org_name_for_dedupe(name):
 *   - (normalized_name, zip_code)  WHERE zip_code IS NOT NULL
 *   - (normalized_name)            WHERE zip_code IS NULL
 * i.e. same name + same zip is a duplicate, same name with no zip is a
 * duplicate, same name in a DIFFERENT zip is allowed.
 *
 * The application guards didn't mirror this. `POST /organizations` only checked
 * the same-zip case; `POST /organizations/create` scanned 100 UNORDERED rows
 * when no zip was given. A no-zip name collision therefore slipped past the app
 * check and hit the DB index as a raw P2002 — surfacing to the user as a 500
 * instead of a clean 409, and nondeterministically across the two routes.
 *
 * Invariant: both routes return a structured 409 (never a 500) for a
 * name collision the DB would reject, and allow the same name in a different
 * zip. The two routes give the same answer for the same input.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);
const DUP_NAME = `OCDP Collision League ${suffix}`;

async function makeApprovedCoach(tag: string) {
  return prisma.user.create({
    data: {
      email: `ocdp-${tag}-${ts}@example.com`,
      username: `ocdp${tag}${suffix}`,
      password_hash: 'x',
      display_name: `OCDP ${tag}`,
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
      plan: 'rookie',
      preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
    },
  });
}

const createdUserIds: string[] = [];

describe('org create duplicate-guard parity', () => {
  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    // Pre-existing collision org WITHOUT a zip (covered by the null-zip index).
    await prisma.organization.create({
      data: {
        name: DUP_NAME,
        admin_approved: true,
        approved_at: new Date(),
        supporting_document_url: 'https://example.com/doc.pdf',
        updated_at: new Date(),
      },
    });

    // Pre-existing collision org WITH a zip (covered by the name+zip index).
    await prisma.organization.create({
      data: {
        name: DUP_NAME,
        zip_code: '10001',
        admin_approved: true,
        approved_at: new Date(),
        supporting_document_url: 'https://example.com/doc.pdf',
        updated_at: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.organizationMembership.deleteMany({
      where: { user_id: { in: createdUserIds } },
    });
    await prisma.organization.deleteMany({ where: { name: DUP_NAME } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('returns a clean 409 (not a 500) for a no-zip collision on /organizations/create', async () => {
    const coach = await makeApprovedCoach('a');
    createdUserIds.push(coach.id);
    const token = signJwt({ id: coach.id });

    const res = await request(app)
      .post('/organizations/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: DUP_NAME, supporting_document_url: 'https://example.com/mine.pdf' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DUPLICATE_ORGANIZATION');
  });

  it('returns a clean 409 (not a 500) for a no-zip collision on /organizations', async () => {
    const coach = await makeApprovedCoach('b');
    createdUserIds.push(coach.id);
    const token = signJwt({ id: coach.id });

    const res = await request(app)
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: DUP_NAME, supporting_document_url: 'https://example.com/mine.pdf' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DUPLICATE_ORGANIZATION');
  });

  it('still 409s a same-zip collision on /organizations/create', async () => {
    const coach = await makeApprovedCoach('c');
    createdUserIds.push(coach.id);
    const token = signJwt({ id: coach.id });

    const res = await request(app)
      .post('/organizations/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: DUP_NAME,
        zip_code: '10001',
        supporting_document_url: 'https://example.com/mine.pdf',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DUPLICATE_ORGANIZATION');
  });

  it('allows the same name in a DIFFERENT zip (zip-scoped, not over-blocking)', async () => {
    const coach = await makeApprovedCoach('d');
    createdUserIds.push(coach.id);
    const token = signJwt({ id: coach.id });

    const res = await request(app)
      .post('/organizations/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: DUP_NAME,
        zip_code: '99998',
        supporting_document_url: 'https://example.com/mine.pdf',
      });

    expect(res.status).toBe(201);
  });
});
