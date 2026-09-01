import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { createR2UploadTicket, getR2KeyPrefix, isR2Configured } from '../lib/r2.js';

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
];

describe('R2 presign', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of R2_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of R2_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('is dormant with no env — isR2Configured false and ticket is null', async () => {
    expect(isR2Configured()).toBe(false);
    expect(
      await createR2UploadTicket({ contentType: 'image/jpeg', contentLength: 1024 })
    ).toBeNull();
  });

  it('is dormant when only some vars are set', async () => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'key';
    // secret + bucket missing
    expect(isR2Configured()).toBe(false);
    expect(
      await createR2UploadTicket({ contentType: 'image/jpeg', contentLength: 1024 })
    ).toBeNull();
  });

  it('presigns a scoped, prefixed key with a public URL when fully configured', async () => {
    process.env.NODE_ENV = 'test';
    process.env.R2_ACCOUNT_ID = 'acct123';
    process.env.R2_ACCESS_KEY_ID = 'AKIAEXAMPLE';
    process.env.R2_SECRET_ACCESS_KEY = 'secretexample';
    process.env.R2_BUCKET = 'varsityhub-media';
    process.env.R2_PUBLIC_BASE_URL = 'https://media.varsityhub.app';

    expect(isR2Configured()).toBe(true);
    const ticket = await createR2UploadTicket({ contentType: 'video/mp4', contentLength: 1024 });
    expect(ticket).not.toBeNull();
    expect(ticket!.key.startsWith(`${getR2KeyPrefix()}/`)).toBe(true);
    expect(ticket!.key.endsWith('.mp4')).toBe(true);
    expect(ticket!.publicUrl).toBe(`https://media.varsityhub.app/${ticket!.key}`);
    expect(ticket!.contentLength).toBe(1024);
    expect(ticket!.maxBytes).toBe(157286400);
    // Presigned PUT URL points at the R2 S3 endpoint and carries a signature.
    expect(ticket!.uploadUrl).toContain('acct123.r2.cloudflarestorage.com');
    expect(ticket!.uploadUrl).toContain('X-Amz-Signature');
    expect(decodeURIComponent(ticket!.uploadUrl)).toContain(
      'X-Amz-SignedHeaders=content-length;content-type;host'
    );
  });

  it('rejects unsupported content types', async () => {
    process.env.R2_ACCOUNT_ID = 'a';
    process.env.R2_ACCESS_KEY_ID = 'b';
    process.env.R2_SECRET_ACCESS_KEY = 'c';
    process.env.R2_BUCKET = 'd';
    await expect(
      createR2UploadTicket({ contentType: 'application/x-msdownload', contentLength: 1024 })
    ).rejects.toThrow(/Unsupported content type/);
  });

  it('requires a positive content length', async () => {
    process.env.R2_ACCOUNT_ID = 'a';
    process.env.R2_ACCESS_KEY_ID = 'b';
    process.env.R2_SECRET_ACCESS_KEY = 'c';
    process.env.R2_BUCKET = 'd';
    await expect(
      createR2UploadTicket({ contentType: 'image/jpeg', contentLength: 0 })
    ).rejects.toThrow(/content_length/);
  });

  it('rejects media over the server-side direct-upload limits', async () => {
    process.env.R2_ACCOUNT_ID = 'a';
    process.env.R2_ACCESS_KEY_ID = 'b';
    process.env.R2_SECRET_ACCESS_KEY = 'c';
    process.env.R2_BUCKET = 'd';
    await expect(
      createR2UploadTicket({ contentType: 'image/jpeg', contentLength: 10 * 1024 * 1024 + 1 })
    ).rejects.toThrow(/File size exceeds/);
    await expect(
      createR2UploadTicket({ contentType: 'video/mp4', contentLength: 150 * 1024 * 1024 + 1 })
    ).rejects.toThrow(/File size exceeds/);
  });
});
