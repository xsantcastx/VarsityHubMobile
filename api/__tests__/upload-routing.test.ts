import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/utils/ensureUploadableUri', () => ({
  compressImageForUpload: jest.fn(async (uri: string, mimeType: string) => ({ uri, mimeType })),
}));

jest.mock('../auth', () => ({
  __esModule: true,
  default: {
    getToken: jest.fn(async () => 'test-token'),
  },
}));

jest.mock('../http', () => ({
  getApiBaseUrl: jest.fn(() => 'https://api.test'),
}));

class MockXHR {
  static instances: MockXHR[] = [];
  static nextStatus = 200;
  static nextResponseText = JSON.stringify({ secure_url: 'https://cloudinary.test/image.jpg' });

  upload = { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  timeout = 0;
  status = MockXHR.nextStatus;
  responseText = MockXHR.nextResponseText;
  method = '';
  url = '';

  constructor() {
    MockXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send() {
    this.onload?.();
  }
}

describe('uploadFile routing', () => {
  const fetchMock = jest.fn() as any;

  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    MockXHR.instances.length = 0;
    MockXHR.nextStatus = 200;
    MockXHR.nextResponseText = JSON.stringify({ secure_url: 'https://cloudinary.test/image.jpg' });
    (global as any).fetch = fetchMock;
    (global as any).XMLHttpRequest = MockXHR;
  });

  afterEach(() => {
    delete (global as any).fetch;
    delete (global as any).XMLHttpRequest;
  });

  it('routes PDFs to /uploads/files instead of the media-only upload path', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: 'https://cdn.test/doc.pdf', type: 'raw', mime: 'application/pdf' }),
    });

    const { uploadFile } = await import('../upload');
    const result = await uploadFile('https://api.test', 'file:///tmp/doc.pdf', 'doc.pdf', 'application/pdf');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/uploads/files');
    expect(result).toEqual({ url: 'https://cdn.test/doc.pdf', type: 'raw', mime: 'application/pdf' });
  });

  it('mirrors onboarding upload context into the query string for server uploads', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ url: 'https://cdn.test/doc.pdf', type: 'raw', mime: 'application/pdf' }),
    });

    const { uploadFile } = await import('../upload');
    await uploadFile('https://api.test', 'file:///tmp/doc.pdf', 'doc.pdf', 'application/pdf', {
      formFields: {
        onboarding: true,
        upload_context: 'organization_supporting_document',
      },
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.test/uploads/files?onboarding=true&upload_context=organization_supporting_document'
    );
  });

  it('routes images through the Cloudinary signature flow before upload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cloudName: 'varsityhub',
        apiKey: 'key',
        signature: 'sig',
        timestamp: 123,
        folder: 'uploads',
      }),
    });

    const { uploadFile } = await import('../upload');
    const result = await uploadFile('https://api.test', 'file:///tmp/pic.jpg', 'pic.jpg', 'image/jpeg');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/uploads/cloudinary-signature');
    expect(MockXHR.instances).toHaveLength(1);
    expect(MockXHR.instances[0]?.url).toBe('https://api.cloudinary.com/v1_1/varsityhub/image/upload');
    expect(result).toEqual({
      url: 'https://cloudinary.test/image.jpg',
      type: 'image',
      mime: 'image/jpeg',
    });
  });

  it('falls back to the server proxy when Cloudinary rejects the direct upload', async () => {
    MockXHR.nextStatus = 401;
    MockXHR.nextResponseText = JSON.stringify({ error: { message: 'Invalid Signature' } });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cloudName: 'varsityhub',
          apiKey: 'key',
          signature: 'sig',
          timestamp: 123,
          folder: 'uploads',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({
          url: 'https://api.test/uploads/fallback.jpg',
          type: 'image',
          mime: 'image/jpeg',
          storage: 'cloudinary',
        }),
      });

    const { uploadFile } = await import('../upload');
    const result = await uploadFile('https://api.test', 'file:///tmp/pic.jpg', 'pic.jpg', 'image/jpeg');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/uploads/cloudinary-signature');
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('https://api.test/uploads');
    expect(result).toEqual({
      url: 'https://api.test/uploads/fallback.jpg',
      type: 'image',
      mime: 'image/jpeg',
      storage: 'cloudinary',
    });
  });
});
