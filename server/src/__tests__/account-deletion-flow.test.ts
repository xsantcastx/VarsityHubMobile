import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';

const mockUserFindUnique = jest.fn();
const mockAssertCanSelfDeleteUser = jest.fn(async () => undefined);
const mockSoftDeleteUserAccount = jest.fn(async () => ({
  deletedAt: new Date('2026-05-19T00:00:00.000Z'),
  alreadyDeleted: false,
}));
const mockInvalidateMeCacheForUser = jest.fn(async () => undefined);

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

jest.unstable_mockModule('../lib/accountDeletion.js', () => ({
  assertCanSelfDeleteUser: mockAssertCanSelfDeleteUser,
  softDeleteUserAccount: mockSoftDeleteUserAccount,
}));

jest.unstable_mockModule('../lib/userCache.js', () => ({
  invalidateMeCacheForUser: mockInvalidateMeCacheForUser,
}));

const { processSelfAccountDeletion } = await import('../lib/accountDeletionFlow.js');

describe('processSelfAccountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertCanSelfDeleteUser.mockResolvedValue(undefined);
    mockSoftDeleteUserAccount.mockResolvedValue({
      deletedAt: new Date('2026-05-19T00:00:00.000Z'),
      alreadyDeleted: false,
    });
    mockInvalidateMeCacheForUser.mockResolvedValue(undefined);
  });

  it('returns 404 when user does not exist', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await processSelfAccountDeletion('u_missing', {
      delete_confirmation: 'DELETE',
    });

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ error: 'Not found' });
    expect(mockAssertCanSelfDeleteUser).not.toHaveBeenCalled();
    expect(mockSoftDeleteUserAccount).not.toHaveBeenCalled();
  });

  it('returns idempotent already_deleted response when user is already anonymized', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'u1',
      password_hash: null,
      google_id: null,
      apple_id: null,
      deleted_at: new Date('2026-05-01T00:00:00.000Z'),
      deletion_anonymized: true,
    });

    const result = await processSelfAccountDeletion('u1', {
      delete_confirmation: 'DELETE',
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      already_deleted: true,
    });
    expect(mockAssertCanSelfDeleteUser).not.toHaveBeenCalled();
    expect(mockSoftDeleteUserAccount).not.toHaveBeenCalled();
  });

  it('returns DELETE_CONFIRMATION_REQUIRED when destructive confirmation is missing', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'u2',
      password_hash: null,
      google_id: 'gid',
      apple_id: null,
      deleted_at: null,
      deletion_anonymized: false,
    });

    const result = await processSelfAccountDeletion('u2', {});

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: 'DELETE_CONFIRMATION_REQUIRED',
    });
    expect(mockAssertCanSelfDeleteUser).not.toHaveBeenCalled();
    expect(mockSoftDeleteUserAccount).not.toHaveBeenCalled();
  });

  it('returns INVALID_PASSWORD when a password account provides the wrong password', async () => {
    const passwordHash = await bcrypt.hash('RightPassword123!', 10);
    mockUserFindUnique.mockResolvedValue({
      id: 'u3',
      password_hash: passwordHash,
      google_id: null,
      apple_id: null,
      deleted_at: null,
      deletion_anonymized: false,
    });

    const result = await processSelfAccountDeletion('u3', {
      delete_confirmation: 'DELETE',
      password: 'WrongPassword123!',
    });

    expect(result.status).toBe(401);
    expect(result.body).toEqual({
      error: 'INVALID_PASSWORD',
      message: 'Password does not match.',
    });
    expect(mockAssertCanSelfDeleteUser).not.toHaveBeenCalled();
    expect(mockSoftDeleteUserAccount).not.toHaveBeenCalled();
  });

  it('maps SOLE_ORG_OWNER guard to a 400 response', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'u4',
      password_hash: null,
      google_id: null,
      apple_id: null,
      deleted_at: null,
      deletion_anonymized: false,
    });
    mockAssertCanSelfDeleteUser.mockRejectedValue({
      code: 'SOLE_ORG_OWNER',
      organization_id: 'org_123',
    });

    const result = await processSelfAccountDeletion('u4', {
      delete_confirmation: 'DELETE',
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      code: 'SOLE_ORG_OWNER',
      organization_id: 'org_123',
    });
    expect(mockSoftDeleteUserAccount).not.toHaveBeenCalled();
  });

  it('soft-deletes and invalidates cache on success (OAuth account, no password required)', async () => {
    const deletedAt = new Date('2026-05-19T12:34:56.000Z');
    mockUserFindUnique.mockResolvedValue({
      id: 'u5',
      password_hash: null,
      google_id: 'gid',
      apple_id: null,
      deleted_at: null,
      deletion_anonymized: false,
    });
    mockSoftDeleteUserAccount.mockResolvedValue({
      deletedAt,
      alreadyDeleted: false,
    });

    const result = await processSelfAccountDeletion('u5', {
      delete_confirmation: 'DELETE',
    });

    expect(mockAssertCanSelfDeleteUser).toHaveBeenCalledWith('u5');
    expect(mockSoftDeleteUserAccount).toHaveBeenCalledWith('u5');
    expect(mockInvalidateMeCacheForUser).toHaveBeenCalledWith('u5');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      deleted_at: deletedAt.toISOString(),
    });
  });
});
