import { getThreadPollIntervalMs } from '@/utils/messagePolling';

describe('getThreadPollIntervalMs', () => {
  it('polls every 60s when the realtime socket is not connected', () => {
    expect(getThreadPollIntervalMs(false)).toBe(60_000);
  });

  it('backs off to a 5-minute safety-net poll while the socket is healthy', () => {
    expect(getThreadPollIntervalMs(true)).toBe(300_000);
  });
});
