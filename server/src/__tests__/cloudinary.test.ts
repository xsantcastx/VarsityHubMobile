import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { uploadBufferToCloudinary } from '../lib/cloudinary.js';

const ORIGINAL_ENV = { ...process.env };

describe('cloudinary upload helper', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: '987654321012345',
      CLOUDINARY_API_SECRET: 'real-cloudinary-secret',
      NODE_ENV: 'test',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        public_id: 'varsityhub/test/banner',
        secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/varsityhub/test/banner.jpg',
        resource_type: 'image',
        bytes: 3,
        format: 'jpg',
      }),
    } as Response) as any;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetAllMocks();
  });

  it('does not send deprecated image_metadata on image uploads', async () => {
    await uploadBufferToCloudinary(
      {
        buffer: Buffer.from([1, 2, 3]),
        originalname: 'banner.jpg',
        mimetype: 'image/jpeg',
        size: 3,
      } as Express.Multer.File,
      { resourceType: 'image' }
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;

    expect(form.has('image_metadata')).toBe(false);
    // v1.0.3: `flags` was dropped from the signed upload params because
    // Cloudinary's signature reconstruction did not include it in production,
    // causing persistent "Invalid Signature" errors. EXIF stripping moves to
    // an upload preset / account-level pipeline (not required here).
    expect(form.has('flags')).toBe(false);
  });

  // v1.0.3: regression test for the "Invalid Signature" production bug.
  // Cloudinary validates the signature by hashing every non-file/non-api_key
  // form param alphabetically. If the server signs over a different set of
  // params than it sends in the form, Cloudinary computes a different hash
  // and rejects with 401 "Invalid Signature". The fix channels all signed
  // params through a single object; this test proves the invariant holds.
  it('keeps the signed param set and the form body in lockstep', async () => {
    const crypto = await import('node:crypto');
    await uploadBufferToCloudinary(
      {
        buffer: Buffer.from([1, 2, 3]),
        originalname: 'banner.jpg',
        mimetype: 'image/jpeg',
        size: 3,
      } as Express.Multer.File,
      { resourceType: 'image' }
    );

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;

    // Reconstruct what Cloudinary will hash: every form field except file,
    // api_key, and signature, sorted alphabetically.
    const unsignedFields = new Set(['file', 'api_key', 'signature']);
    const signedFromForm: Record<string, string> = {};
    form.forEach((value, key) => {
      if (unsignedFields.has(key)) return;
      signedFromForm[key] = String(value);
    });
    const toSign = Object.keys(signedFromForm)
      .sort()
      .map((k) => `${k}=${signedFromForm[k]}`)
      .join('&');
    const expected = crypto
      .createHash('sha1')
      .update(`${toSign}${process.env.CLOUDINARY_API_SECRET}`)
      .digest('hex');

    expect(form.get('signature')).toBe(expected);
  });
});
