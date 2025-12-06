type LogArgs = Parameters<typeof console.log>;

const shouldEnableLogs = () =>
  process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production';

let override: boolean | null = null;

export const setDebugLogging = (enabled: boolean) => {
  override = enabled;
};

const isEnabled = () => {
  if (override !== null) return override;
  return shouldEnableLogs();
};

export const debugLog = (...args: LogArgs) => {
  if (!isEnabled()) return;
  console.log(...args);
};
