import { httpGet, httpPost } from './http';

async function getPaymentsConfig(): Promise<{
  stripe_publishable_key: string;
  available_plans: any[];
  payments_enabled: boolean;
  stripe_configured: boolean;
  has_webhook_secret: boolean;
}> {
  try {
    return await httpGet('/payments/config');
  } catch (err: any) {
    if (err?.status === 404) {
      try {
        const health = await httpGet('/health?include=payments');
        const cfg = (health as any)?.payments_config;
        if (cfg) return cfg;
      } catch {
        // Health may not support include=payments (old server) - fall through to throw original
      }
    }
    throw err;
  }
}

export const Payments = {
  configStatus: getPaymentsConfig,
  getConfig: getPaymentsConfig,
};

export const Subscriptions = {
  createCheckout: (plan: string, teamCount?: number) => httpPost('/payments/checkout', { plan, team_count: teamCount }),
  finalizeSession: (sessionId: string) => httpPost('/payments/finalize-session', { session_id: sessionId }),
  cancel: () => httpPost('/payments/subscription/cancel', {}),
  updateQuantity: (teamCount: number) => httpPost('/payments/update-subscription-quantity', { team_count: teamCount }),
  getSummary: () => httpGet('/payments/subscription/summary'),
};
