/**
 * useVHubIAP — Web stub.
 * IAP is not available on web. This stub provides the same interface
 * so that components importing useVHubIAP don't break the Metro web bundle.
 */

export const IAP_PRODUCT_IDS = {
  veteran: 'MIDTIER',
  legend: 'TOPTIER',
} as const;

export function useVHubIAP() {
  return {
    connected: false,
    products: [] as any[],
    purchasing: false,
    error: 'IAP is not available on web' as string | null,
    purchase: async (_plan: 'veteran' | 'legend') => false,
    getProduct: (_plan: 'veteran' | 'legend') => undefined as any,
    restore: async () => false,
  };
}
