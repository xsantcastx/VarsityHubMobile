export const formatUsd = (cents?: number | null) => {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return '';
  return `$${(cents / 100).toFixed(2)}`;
};

export function getPastAdDates(isoDates: string[], now: Date = new Date()): string[] {
  const todayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  return isoDates.filter(dateIso => dateIso < todayIso);
}

export function getCheckoutReturnUrls(params: {
  type: 'subscription' | 'ad';
  mode?: 'app' | 'web';
}) {
  if (params.mode === 'web') {
    const appBase = (process.env.APP_BASE_URL || process.env.EXPO_PUBLIC_API_URL || '')
      .trim()
      .replace(/\/$/, '');
    if (!appBase && process.env.NODE_ENV === 'production') {
      throw new Error('APP_BASE_URL must be set in production');
    }
    const base = appBase || 'http://localhost:8081';
    return {
      success: `${base}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=${params.type}`,
      cancel: `${base}/payment-cancel${params.type === 'ad' ? '?type=ad' : ''}`,
    };
  }

  const appScheme = 'varsityhubmobile';
  return {
    success: `${appScheme}://payment-success?session_id={CHECKOUT_SESSION_ID}&type=${params.type}`,
    cancel: `${appScheme}://payment-cancel${params.type === 'ad' ? '?type=ad' : ''}`,
  };
}
