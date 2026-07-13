import { renderHook, act, waitFor } from '@testing-library/react-native';

type Handler = (...args: any[]) => void;

function makeFakeSocket() {
  const handlers: Record<string, Handler[]> = {};
  return {
    connected: false,
    on: jest.fn((event: string, fn: Handler) => {
      (handlers[event] ||= []).push(fn);
    }),
    off: jest.fn((event: string, fn: Handler) => {
      handlers[event] = (handlers[event] || []).filter(h => h !== fn);
    }),
    emit: jest.fn(),
    fire(event: string, ...args: any[]) {
      (handlers[event] || []).forEach(h => h(...args));
    },
  };
}

const fakeSocket = makeFakeSocket();

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => fakeSocket),
}));

jest.mock('@/api/http', () => ({
  getApiBaseUrl: () => 'http://localhost:4000',
  getAccessTokenForRequest: async () => 'test-token',
}));

import { useConversationSocket } from '@/hooks/useConversationSocket';

describe('useConversationSocket connection state', () => {
  it('returns false before the socket connects and true after', async () => {
    const { result } = renderHook(() => useConversationSocket('conv-1', jest.fn()));

    expect(result.current).toBe(false);

    // Wait for the async getSocket() to attach listeners, then simulate connect.
    await waitFor(() => {
      expect(fakeSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });
    act(() => {
      fakeSocket.connected = true;
      fakeSocket.fire('connect');
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
