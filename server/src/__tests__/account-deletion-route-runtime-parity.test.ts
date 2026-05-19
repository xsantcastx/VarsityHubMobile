import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';

const mockProcessSelfAccountDeletion = jest.fn();

jest.unstable_mockModule('../lib/accountDeletionFlow.js', () => ({
  accountDeletionPayloadSchema: z.object({
    password: z.string().optional(),
    delete_confirmation: z.string().optional(),
  }),
  processSelfAccountDeletion: mockProcessSelfAccountDeletion,
}));

const { authRouter } = await import('../routes/auth.js');
const { usersRouter } = await import('../routes/users.js');

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: 'user_123' };
  next();
});
app.use('/auth', authRouter);
app.use('/users', usersRouter);

describe('account deletion route runtime parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessSelfAccountDeletion.mockResolvedValue({
      status: 200,
      body: {
        ok: true,
        deleted_at: '2026-05-19T00:00:00.000Z',
      },
    });
  });

  it('POST /auth/account/delete delegates to the shared flow and passes through response contract', async () => {
    const payload = { delete_confirmation: 'DELETE', password: 'Password123!' };
    const res = await request(app).post('/auth/account/delete').send(payload);

    expect(mockProcessSelfAccountDeletion).toHaveBeenCalledWith('user_123', payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      deleted_at: '2026-05-19T00:00:00.000Z',
    });
  });

  it('DELETE /users/me delegates to the shared flow and passes through response contract', async () => {
    const payload = { delete_confirmation: 'DELETE', password: 'Password123!' };
    const res = await request(app).delete('/users/me').send(payload);

    expect(mockProcessSelfAccountDeletion).toHaveBeenCalledWith('user_123', payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      deleted_at: '2026-05-19T00:00:00.000Z',
    });
  });

  it('keeps both route aliases consistent for non-200 failure payloads from the shared flow', async () => {
    mockProcessSelfAccountDeletion.mockResolvedValue({
      status: 401,
      body: { error: 'INVALID_PASSWORD', message: 'Password does not match.' },
    });

    const authRes = await request(app).post('/auth/account/delete').send({
      delete_confirmation: 'DELETE',
      password: 'bad',
    });
    const usersRes = await request(app).delete('/users/me').send({
      delete_confirmation: 'DELETE',
      password: 'bad',
    });

    expect(authRes.status).toBe(401);
    expect(usersRes.status).toBe(401);
    expect(authRes.body).toEqual(usersRes.body);
  });

  it('rejects invalid payloads at the schema layer before shared flow execution', async () => {
    const invalidPayload = { delete_confirmation: 'DELETE', password: 12345 };

    const authRes = await request(app).post('/auth/account/delete').send(invalidPayload);
    const usersRes = await request(app).delete('/users/me').send(invalidPayload);

    expect(authRes.status).toBe(400);
    expect(usersRes.status).toBe(400);
    expect(authRes.body).toEqual({ error: 'Invalid payload' });
    expect(usersRes.body).toEqual({ error: 'Invalid payload' });
    expect(mockProcessSelfAccountDeletion).not.toHaveBeenCalled();
  });
});
