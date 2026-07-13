// Message-thread polling cadence. Realtime delivery comes from the
// conversation socket (hooks/useConversationSocket.ts); polling stays as the
// fallback, not removed. While the socket is healthy the poll is only a
// safety net, so it backs off to spare the server redundant thread reads.
export const THREAD_POLL_FALLBACK_MS = 60_000;
export const THREAD_POLL_SOCKET_HEALTHY_MS = 300_000;

export function getThreadPollIntervalMs(socketConnected: boolean): number {
  return socketConnected ? THREAD_POLL_SOCKET_HEALTHY_MS : THREAD_POLL_FALLBACK_MS;
}
