import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import crypto from 'node:crypto';
import { uploadBufferToCloudinary } from '../lib/cloudinary.js';

const ORIGINAL_ENV = { ...process.env };

/**
 * Reconstruct what Cloudinary will hash from a FormData body. Cloudinary's
 * signature algorithm takes every form param EXCEPT file, api_key, and
 * signature, sorts them alphabetically, joins as key=value&..., then
 * SHA1-hashes with the API secret appended.
 *
 * This helper lets every test pin the invariant: "our signature matches
 * what Cloudinary will compute from what we actually sent."
 */
function expectedCloudinarySignature(form: FormData, apiSecret: string): string {
  const unsigned = new Set(['file', 'api_key', 'signature']);
  const fields: Record<string, string> = {};
  form.forEach((value, key) => {
    if (unsigned.has(key)) return;
    fields[key] = String(value);
  });
  const toSign = Object.keys(fields)
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

function makeFile(mimetype: string, name = 'upload.bin'): Express.Multer.File {
  return {
    buffer: Buffer.from([1, 2, 3]),
    originalname: name,
    mimetype,
    size: 3,
  } as Express.Multer.File;
}

function getFetchForm(): FormData {
  const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
  return init.body as FormData;
}

function getFetchUrl(): string {
  const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
  return url;
}

describe('cloudinary upload helper — universal signature & form-parity suite', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: '987654321012345',
      CLOUDINARY_API_SECRET: 'real-cloudinary-secret',
      NODE_ENV: 'production',
    };
    delete process.env.CLOUDINARY_MODERATION;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        public_id: 'varsityhub/production/banner',
        secure_url:
          'https://res.cloudinary.com/demo-cloud/image/upload/v1/varsityhub/production/banner.jpg',
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

  // ──────────────────────────────────────────────────────────────────────
  // Signature-form parity (the invariant we keep breaking if we're not
  // careful). One test per resource type + every configuration permutation
  // that affects which params enter the signed set.
  // ──────────────────────────────────────────────────────────────────────

  describe('signature matches what Cloudinary reconstructs from the form body', () => {
    it('image upload (server-proxy path from /uploads)', async () => {
      await uploadBufferToCloudinary(makeFile('image/jpeg', 'banner.jpg'), {
        resourceType: 'image',
      });
      const form = getFetchForm();
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('video upload (audio_codec + video_codec become signed params)', async () => {
      await uploadBufferToCloudinary(makeFile('video/mp4', 'clip.mp4'), { resourceType: 'video' });
      const form = getFetchForm();
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('auto upload (used by /uploads/files for PDFs and misc media)', async () => {
      await uploadBufferToCloudinary(makeFile('application/pdf', 'doc.pdf'), {
        resourceType: 'auto',
      });
      const form = getFetchForm();
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('avatar upload (forced resourceType: image)', async () => {
      await uploadBufferToCloudinary(makeFile('image/png', 'avatar.png'), {
        resourceType: 'image',
      });
      const form = getFetchForm();
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('image upload with AWS Rekognition moderation enabled', async () => {
      process.env.CLOUDINARY_MODERATION = 'aws_rek';
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      const form = getFetchForm();
      expect(form.has('moderation')).toBe(true);
      expect(form.get('moderation')).toBe('aws_rek');
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('video upload with manual moderation enabled (4 signed params)', async () => {
      process.env.CLOUDINARY_MODERATION = 'manual';
      await uploadBufferToCloudinary(makeFile('video/quicktime'), { resourceType: 'video' });
      const form = getFetchForm();
      expect(form.has('moderation')).toBe(true);
      expect(form.get('audio_codec')).toBe('aac');
      expect(form.get('video_codec')).toBe('auto');
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('inferred resource type (no opts.resourceType) — image mimetype', async () => {
      await uploadBufferToCloudinary(makeFile('image/webp'));
      const form = getFetchForm();
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('inferred resource type (no opts.resourceType) — video mimetype', async () => {
      await uploadBufferToCloudinary(makeFile('video/webm'));
      const form = getFetchForm();
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('custom folder override still signs correctly', async () => {
      await uploadBufferToCloudinary(makeFile('image/jpeg'), {
        resourceType: 'image',
        folder: 'varsityhub/staging/ads',
      });
      const form = getFetchForm();
      expect(form.get('folder')).toBe('varsityhub/staging/ads');
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Production regression — the bugs we've actually hit
  // ──────────────────────────────────────────────────────────────────────

  describe('production regressions', () => {
    it("does NOT re-introduce 'flags' as a signed param (Cloudinary strips it)", async () => {
      // This bug surfaced in production as persistent "Invalid Signature"
      // errors because Cloudinary's signature reconstruction excluded `flags`
      // even though we were sending it. If someone re-adds it, this test
      // catches it — both from the form body and from the signed string.
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      const form = getFetchForm();
      expect(form.has('flags')).toBe(false);
    });

    it('does NOT send the deprecated image_metadata param', async () => {
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      const form = getFetchForm();
      expect(form.has('image_metadata')).toBe(false);
    });

    it('trims NODE_ENV so a trailing newline cannot poison the folder', async () => {
      process.env.NODE_ENV = 'production\n';
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      const form = getFetchForm();
      expect(form.get('folder')).toBe('varsityhub/production'); // no trailing \n
      expect(form.get('signature')).toBe(
        expectedCloudinarySignature(form, process.env.CLOUDINARY_API_SECRET as string)
      );
    });

    it('trims NODE_ENV when it has leading/trailing whitespace', async () => {
      process.env.NODE_ENV = '  production  ';
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      const form = getFetchForm();
      expect(form.get('folder')).toBe('varsityhub/production');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Structural invariants — things that MUST be true regardless of inputs
  // ──────────────────────────────────────────────────────────────────────

  describe('structural invariants', () => {
    it('always POSTs to the correct Cloudinary endpoint per resource type', async () => {
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      expect(getFetchUrl()).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');

      jest.resetAllMocks();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          public_id: 'p',
          secure_url: 'u',
          resource_type: 'video',
          bytes: 3,
          format: 'mp4',
        }),
      } as Response) as any;
      await uploadBufferToCloudinary(makeFile('video/mp4'), { resourceType: 'video' });
      expect(getFetchUrl()).toBe('https://api.cloudinary.com/v1_1/demo-cloud/video/upload');
    });

    it('always includes file, api_key, signature in the form body (protocol required)', async () => {
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      const form = getFetchForm();
      expect(form.has('file')).toBe(true);
      expect(form.has('api_key')).toBe(true);
      expect(form.has('signature')).toBe(true);
      expect(form.get('api_key')).toBe(process.env.CLOUDINARY_API_KEY);
    });

    it('always includes folder and timestamp as signed params', async () => {
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      const form = getFetchForm();
      expect(form.has('folder')).toBe(true);
      expect(form.has('timestamp')).toBe(true);
      expect(Number(form.get('timestamp'))).toBeGreaterThan(0);
    });

    it('signature is 40-character lowercase hex (SHA1)', async () => {
      await uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' });
      const sig = String(getFetchForm().get('signature'));
      expect(sig).toMatch(/^[a-f0-9]{40}$/);
    });

    it('throws CloudinaryUpstreamError (not generic Error) on 401', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid Signature xxx. String to sign - "folder=...&timestamp=..."' },
        }),
      } as Response) as any;
      await expect(
        uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' })
      ).rejects.toMatchObject({
        name: 'CloudinaryUpstreamError',
        http_code: 401,
        kind: 'invalid_signature',
        isUpstreamFailure: true,
      });
    });

    it('classifies 401 "Unknown API key" as unauthorized (not invalid_signature)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unknown API key abc' } }),
      } as Response) as any;
      await expect(
        uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' })
      ).rejects.toMatchObject({
        name: 'CloudinaryUpstreamError',
        kind: 'unauthorized',
      });
    });

    it('classifies 5xx failures as server_error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'Service unavailable' } }),
      } as Response) as any;
      await expect(
        uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' })
      ).rejects.toMatchObject({
        name: 'CloudinaryUpstreamError',
        kind: 'server_error',
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Guard — misconfigured credentials
  // ──────────────────────────────────────────────────────────────────────

  describe('credential validation', () => {
    it('throws a non-upstream error when credentials are missing', async () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      await expect(
        uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' })
      ).rejects.toThrow(/not configured/i);
    });

    it('throws a non-upstream error when placeholder credentials are detected', async () => {
      process.env.CLOUDINARY_API_SECRET = 'your-api-secret';
      await expect(
        uploadBufferToCloudinary(makeFile('image/jpeg'), { resourceType: 'image' })
      ).rejects.toThrow(/placeholder/i);
    });
  });
});
