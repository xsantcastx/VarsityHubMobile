import { afterAll, afterEach, beforeAll } from '@jest/globals';
import bcrypt from 'bcrypt';
import type { ObjectStorageAdapter } from '../../lib/objectStorage.js';
import { prisma } from '../../lib/prisma.js';

export class MockObjectStorageNotConfiguredError extends Error {}

export const storageState: { current: ObjectStorageAdapter } = {
  current: {
    isConfigured: () => false,
    async putObject() {
      throw new Error('storage not configured');
    },
    async getSignedDownloadUrl() {
      throw new Error('storage not configured');
    },
    async deleteObject() {
      return;
    },
  },
};

export function makeFakeStorage(opts: { configured?: boolean; failDeleteOn?: string } = {}) {
  const puts: Array<{ key: string; contentType: string; sizeBytes: number }> = [];
  const deletes: string[] = [];
  const state = { failDeleteOn: opts.failDeleteOn };

  return {
    puts,
    deletes,
    adapter: {
      isConfigured: () => opts.configured !== false,
      async putObject(key: string, body: Buffer, contentType: string) {
        puts.push({
          key,
          contentType,
          sizeBytes: Buffer.isBuffer(body) ? body.byteLength : 0,
        });
      },
      async getSignedDownloadUrl(key: string, ttlSeconds = 300) {
        return `https://fake-storage.test/${key}?ttl=${ttlSeconds}&sig=fake`;
      },
      async deleteObject(key: string) {
        if (state.failDeleteOn === key) throw new Error('simulated storage failure');
        deletes.push(key);
      },
    } satisfies ObjectStorageAdapter,
    setFailDeleteOn(key?: string) {
      state.failDeleteOn = key;
    },
  };
}

export function resetStorageState() {
  storageState.current = makeFakeStorage({ configured: false }).adapter;
}

export function setupDataExportUserLifecycle(args: {
  emailPrefix: string;
  displayName: string;
  password: string;
}) {
  const ts = Date.now();
  let userId = '';

  beforeAll(async () => {
    const hash = await bcrypt.hash(args.password, 10);
    const user = await prisma.user.create({
      data: {
        email: `${args.emailPrefix}-${ts}@example.com`,
        password_hash: hash,
        display_name: args.displayName,
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  afterEach(async () => {
    await (prisma as any).dataExport.deleteMany({ where: { user_id: userId } });
    resetStorageState();
  });

  return {
    getUserId() {
      return userId;
    },
  };
}
