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
    expect(form.get('flags')).toBe('exif_autostrip,strip_profile');
  });
});
