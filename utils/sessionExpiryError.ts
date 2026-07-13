export function isSessionExpiryError(err: any): boolean {
  const status = err?.status || err?.response?.status;
  const serverData = err?.data || err?.response?.data;
  const message = String(
    serverData?.error || serverData?.message || err?.message || ''
  ).toLowerCase();
  return err?.isSessionExpired === true || (status === 401 && message.includes('session expired'));
}
