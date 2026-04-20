import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSend = jest.fn();
const mockUpdate = jest.fn();
const mockFindUnique = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: class {
    send = mockSend;
  },
  DetectModerationLabelsCommand: class {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
}));

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    ad: {
      update: mockUpdate,
      findUnique: mockFindUnique,
    },
  },
}));

jest.unstable_mockModule('../lib/env.js', () => ({
  env: {
    AD_IMAGE_MODERATION_ENABLED: '1',
    AD_IMAGE_MODERATION_MIN_CONFIDENCE: '75',
    REKOGNITION_REGION: 'us-east-1',
  },
}));

const { clearBannerModerationFields, moderateAndStoreAdBanner, moderateBannerUrl } = await import(
  '../lib/adImageModeration.js'
);

describe('adImageModeration', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockUpdate.mockReset();
    mockFindUnique.mockReset();
    global.fetch = jest.fn() as any;
  });

  it('marks a banner clean when Rekognition returns no moderation labels', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    });
    mockSend.mockResolvedValueOnce({ ModerationLabels: [] });

    const result = await moderateBannerUrl('https://example.com/banner.jpg');

    expect(result?.banner_moderation_status).toBe('clean');
    expect(result?.banner_moderation_labels).toEqual({});
    expect(result?.banner_moderation_error).toBeNull();
    expect(result?.banner_moderation_provider).toBe('aws_rekognition');
  });

  it('marks a banner flagged when Rekognition returns moderation labels', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    });
    mockSend.mockResolvedValueOnce({
      ModerationLabels: [
        { Name: 'Explicit Nudity', ParentName: 'Nudity', Confidence: 99.4 },
        { Name: 'Suggestive', ParentName: 'Explicit', Confidence: 82.1 },
      ],
    });

    const result = await moderateBannerUrl('https://example.com/banner.jpg');

    expect(result?.banner_moderation_status).toBe('flagged');
    expect(result?.banner_moderation_score).toBe(99.4);
    expect(result?.banner_moderation_labels).toEqual([
      { name: 'Explicit Nudity', parent_name: 'Nudity', confidence: 99.4 },
      { name: 'Suggestive', parent_name: 'Explicit', confidence: 82.1 },
    ]);
  });

  it('clears stored moderation fields when a banner is removed', async () => {
    mockUpdate.mockResolvedValueOnce({ id: 'ad-1' });

    await moderateAndStoreAdBanner('ad-1', null);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'ad-1' },
      data: clearBannerModerationFields(),
    });
  });
});
