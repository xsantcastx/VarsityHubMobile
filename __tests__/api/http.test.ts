jest.mock('@/utils/sentry', () => ({
  captureBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

import { httpGet, httpPost } from '@/api/http';

describe('http client retry behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not retry failed POST requests by default', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network request failed'));
    (global as any).fetch = fetchMock;

    await expect(httpPost('/users/test-action', { ok: true })).rejects.toThrow(
      'Cannot connect to server'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still retries failed GET requests', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ ok: true }),
      });
    (global as any).fetch = fetchMock;

    const result = await httpGet('/health', {}, 30000, 2);
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
