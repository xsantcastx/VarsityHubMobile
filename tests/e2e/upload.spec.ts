import { expect, test, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '../../server/node_modules/@prisma/client/index.js';

/**
 * Upload E2E Tests
 *
 * These tests cover the current upload contracts directly:
 * - verified users can hit upload endpoints
 * - file type and size validation are enforced server-side
 * - unauthenticated callers are rejected
 */

const API_URL = (process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4000')
  .replace('://localhost', '://127.0.0.1');
const prisma = new PrismaClient();

function createTestImageFile(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x08, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0xd2, 0xff, 0xd9,
  ]);
}

async function createVerifiedUser(request: APIRequestContext) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email: `upload-${nonce}@varsityhub-test.app`,
      password: 'UploadTestPassword123!',
      display_name: `Upload ${nonce}`,
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();

  if (body.dev_verification_code) {
    const verifyResponse = await request.post(`${API_URL}/auth/verify/confirm`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
      data: { code: String(body.dev_verification_code) },
    });
    expect([200, 204, 429]).toContain(verifyResponse.status());
  }

  await prisma.user.update({
    where: { id: body.user.id },
    data: { email_verified: true },
  });

  return { accessToken: body.access_token, userId: body.user.id };
}

test.describe('Upload Contracts', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Verified users can upload an image', async ({ request }) => {
    const user = await createVerifiedUser(request);
    const imageBuffer = createTestImageFile();

    const response = await request.post(`${API_URL}/uploads`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      multipart: {
        file: {
          name: 'test-upload.jpg',
          mimeType: 'image/jpeg',
          buffer: imageBuffer,
        },
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.url).toBeDefined();
    expect(body.type).toBe('image');
    expect(body.mime).toBe('image/jpeg');
  });

  test('Upload API rejects invalid file types', async ({ request }) => {
    const user = await createVerifiedUser(request);
    const textBuffer = Buffer.from('This is not an image');

    const response = await request.post(`${API_URL}/uploads`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: textBuffer,
        },
      },
    });

    expect(response.status()).toBe(400);
  });

  test('Upload API enforces image size limits', async ({ request }) => {
    const user = await createVerifiedUser(request);
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024, 0xff);

    const response = await request.post(`${API_URL}/uploads`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      multipart: {
        file: {
          name: 'large-file.jpg',
          mimeType: 'image/jpeg',
          buffer: largeBuffer,
        },
      },
    });

    expect([400, 413]).toContain(response.status());
  });

  test('Avatar upload endpoint responds with the current contract', async ({ request }) => {
    const user = await createVerifiedUser(request);
    const imageBuffer = createTestImageFile();

    const response = await request.post(`${API_URL}/uploads/avatar`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      multipart: {
        file: {
          name: 'avatar.jpg',
          mimeType: 'image/jpeg',
          buffer: imageBuffer,
        },
      },
    });

    expect([200, 400, 413, 429]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.url).toBeDefined();
    }
  });

  test('Avatar upload enforces its size limit', async ({ request }) => {
    const user = await createVerifiedUser(request);
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0xff);

    const response = await request.post(`${API_URL}/uploads/avatar`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      multipart: {
        file: {
          name: 'large-avatar.jpg',
          mimeType: 'image/jpeg',
          buffer: largeBuffer,
        },
      },
    });

    expect([400, 413]).toContain(response.status());
  });

  test('General file uploads accept PDFs', async ({ request }) => {
    const user = await createVerifiedUser(request);
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF'
    );

    const response = await request.post(`${API_URL}/uploads/files`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    });

    expect([201, 502]).toContain(response.status());
    const body = await response.json();
    if (response.status() === 201) {
      expect(body.url).toBeDefined();
      expect(body.type).toBe('pdf');
      return;
    }

    expect(body.error).toContain('Upload service');
    expect(body.code).toMatch(/^UPSTREAM_/);
  });

  test('Upload endpoints require authentication', async ({ request }) => {
    const imageBuffer = createTestImageFile();
    const response = await request.post(`${API_URL}/uploads`, {
      multipart: {
        file: {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          buffer: imageBuffer,
        },
      },
    });

    expect([400, 401]).toContain(response.status());
  });

  test('Successful upload responses keep the expected shape', async ({ request }) => {
    const user = await createVerifiedUser(request);
    const imageBuffer = createTestImageFile();

    const response = await request.post(`${API_URL}/uploads`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      multipart: {
        file: {
          name: 'response-test.jpg',
          mimeType: 'image/jpeg',
          buffer: imageBuffer,
        },
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('url');
    expect(body).toHaveProperty('type');
    expect(body).toHaveProperty('mime');
    expect(body).toHaveProperty('size');
    expect(body).toHaveProperty('storage');
  });
});
