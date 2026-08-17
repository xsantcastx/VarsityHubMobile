/**
 * Regression: GET /events must validate the `status` query param against the
 * EventStatus enum (draft|approved|rejected|cancelled). A caller passing an
 * unknown value (e.g. ?status=upcoming) previously reached
 * prisma.event.findMany({ where: { status: 'upcoming' } }), which throws a
 * PrismaClientValidationError -> unhandled 500 in production
 * (Sentry VARSITYHUB-3W). Invalid values must fail closed with a 400 instead.
 */
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

describe('GET /events status validation', () => {
  it('rejects an invalid status value with 400 instead of a 500 crash', async () => {
    const res = await request(app).get('/events').query({ status: 'upcoming' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid status');
  });

  it('still accepts a valid EventStatus value', async () => {
    const res = await request(app).get('/events').query({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
