import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockStored = new Map<string, string>();
const mockUnreadable = new Set<string>();
const mockDelete = jest.fn(async (key: string) => {
  mockStored.delete(key);
});
const mockExpired = jest.fn();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  getItemAsync: jest.fn(async (key: string) => {
    if (mockUnreadable.has(key)) throw new Error('Keychain temporarily unavailable');
    return mockStored.get(key) ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStored.set(key, value);
  }),
  deleteItemAsync: (...args: [string]) => mockDelete(...args),
}));
jest.mock('@/utils/sessionEvents', () => ({
  emitSessionExpired: (...args: unknown[]) => mockExpired(...args),
}));
jest.mock('@/utils/sentry', () => ({
  captureBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@/hooks/useVerificationGate', () => ({
  openVerificationGate: jest.fn(async () => false),
  isEmailVerificationRequiredError: () => false,
}));

const ACCESS_KEY = 'auth_token_key';
const REFRESH_KEY = 'refresh_token_key';
const originalFetch = global.fetch;
const fetchMock = jest.fn<typeof fetch>();

function response(status: number, data: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(data),
  } as Response;
}

beforeEach(() => {
  jest.resetModules();
  mockStored.clear();
  mockUnreadable.clear();
  mockDelete.mockClear();
  mockExpired.mockClear();
  fetchMock.mockReset();
  global.fetch = fetchMock;
  mockStored.set(ACCESS_KEY, 'fixture-access');
  mockStored.set(REFRESH_KEY, 'fixture-refresh');
});

afterEach(async () => {
  const http = await import('../http');
  http.clearAuthToken();
  global.fetch = originalFetch;
});

describe('native credential storage recovery', () => {
  it('distinguishes an unreadable access token from an absent token and recovers on retry', async () => {
    const { auth } = await import('../auth');
    mockUnreadable.add(ACCESS_KEY);
    await expect(auth.getToken()).rejects.toMatchObject({ isTransientAuthError: true });
    expect(mockDelete).not.toHaveBeenCalled();
    mockUnreadable.clear();
    await expect(auth.getToken()).resolves.toBe('fixture-access');
  });

  it('does not classify an unreadable refresh token as a missing session', async () => {
    const { auth } = await import('../auth');
    mockUnreadable.add(REFRESH_KEY);
    await expect(auth.refreshToken()).resolves.toMatchObject({
      accessToken: null,
      reason: 'network',
      error: { isTransientAuthError: true },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockStored.get(REFRESH_KEY)).toBe('fixture-refresh');
  });

  it.each(['new login', 'logout'])(
    'ignores a persisted access read completed after %s',
    async action => {
      const { auth } = await import('../auth');
      const http = await import('../http');
      const secureStore = await import('expo-secure-store');
      let finishRead!: (value: string) => void;
      jest.mocked(secureStore.getItemAsync).mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishRead = resolve;
          })
      );
      const pendingRead = auth.getToken();
      if (action === 'new login') http.setAuthToken('fixture-account-b');
      else await auth.clearTokensOnly();
      finishRead('fixture-account-a');
      const expected = action === 'new login' ? 'fixture-account-b' : null;
      await expect(pendingRead).resolves.toBe(expected);
      expect(http.getAuthToken()).toBe(expected);
    }
  );

  it('preserves credentials across an expired access request while Keychain is unavailable', async () => {
    const http = await import('../http');
    http.setAuthToken('fixture-access');
    mockUnreadable.add(REFRESH_KEY);
    fetchMock.mockResolvedValue(response(401, { error: 'Access token expired' }));
    // The old transport intentionally leaves expired-session calls pending after
    // emitting its redirect. Bound that behavior so the regression fails fast.
    const outcome = await Promise.race([
      http.httpPost('/fixture-protected', {}).catch(error => error),
      new Promise(resolve => setTimeout(() => resolve('session redirect left call pending'), 100)),
    ]);
    expect(outcome).toMatchObject({ status: 503, isTransientAuthError: true });
    expect(mockExpired).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();

    mockUnreadable.clear();
    http.clearAuthToken(); // Simulate a cold start with only persisted credentials.
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(response(401, { error: 'Access token expired' }))
      .mockResolvedValueOnce(
        response(200, { access_token: 'fixture-new-access', refresh_token: 'fixture-new-refresh' })
      )
      .mockResolvedValueOnce(response(200, { restored: true }));
    await expect(http.httpPost('/fixture-protected', {})).resolves.toEqual({ restored: true });
    expect(mockStored.get(REFRESH_KEY)).toBe('fixture-new-refresh');
    expect(mockExpired).not.toHaveBeenCalled();
  });

  it('still reports a truly absent refresh token as missing', async () => {
    const { auth } = await import('../auth');
    mockStored.delete(REFRESH_KEY);
    await expect(auth.refreshToken()).resolves.toEqual({ accessToken: null, reason: 'missing' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still clears credentials when the server explicitly rejects the refresh token', async () => {
    const { auth } = await import('../auth');
    fetchMock.mockResolvedValue(response(401, { error: 'Invalid refresh token' }));
    await expect(auth.refreshToken()).resolves.toMatchObject({ accessToken: null, reason: 'auth' });
    expect(mockStored.has(ACCESS_KEY)).toBe(false);
    expect(mockStored.has(REFRESH_KEY)).toBe(false);
  });

  it('preserves credentials when refresh returns a temporary service failure', async () => {
    const { auth } = await import('../auth');
    fetchMock.mockResolvedValue(response(503, { error: 'Session refresh unavailable' }));
    await expect(auth.refreshToken()).resolves.toMatchObject({
      accessToken: null,
      reason: 'network',
    });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockStored.get(REFRESH_KEY)).toBe('fixture-refresh');
  });
});
